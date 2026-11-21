import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { command } from "@/lib/ipc";
import { productionEntries, productionOrders } from "@/data/mock/seed";
import { nextStage, workingStage } from "@/lib/production";
import type { BoxSpec, OrderPriority, ProductionEntry, ProductionOrder, ProductionStage, WastageReason } from "@/types/domain";

export interface OrderInput {
  customer: string;
  customerRef?: string;
  product: string;
  spec: BoxSpec;
  plannedQty: number;
  priority: OrderPriority;
  startDate: string;
  dueDate: string;
  notes?: string;
}

export interface EntryInput {
  orderId: string;
  date: string;
  stage: ProductionStage;
  goodQty: number;
  wastageQty: number;
  wastageReason?: WastageReason;
  note?: string;
}

const fail = (kind: string, message: string) => ({ kind, message });
const today = () => format(new Date(), "yyyy-MM-dd");

/* ── mock "database" (in-memory; the Rust commands will enforce the same rules) ── */
function findOrder(id: string) {
  const o = productionOrders.find((x) => x.id === id);
  if (!o) throw fail("NotFound", "This production order no longer exists.");
  return o;
}

function recalc(o: ProductionOrder) {
  const es = productionEntries.filter((e) => e.orderId === o.id);
  o.producedQty = es.reduce((s, e) => s + e.goodQty, 0);
  o.wastageQty = es.reduce((s, e) => s + e.wastageQty, 0);
}

function nextOrderNo() {
  const max = Math.max(...productionOrders.map((o) => Number(o.orderNo.replace(/\D/g, "")) || 0), 1000);
  return `PO-${max + 1}`;
}

const mock = {
  create(input: OrderInput): ProductionOrder {
    if (input.dueDate < input.startDate) throw fail("Validation", "Due date can't be before the start date.");
    const o: ProductionOrder = {
      ...input,
      id: `p${Date.now()}`,
      orderNo: nextOrderNo(),
      producedQty: 0,
      wastageQty: 0,
      stage: "planned",
      createdAt: new Date().toISOString(),
    };
    productionOrders.unshift(o);
    return o;
  },
  update(id: string, input: OrderInput): ProductionOrder {
    const o = findOrder(id);
    if (o.stage === "completed") throw fail("Conflict", "Completed orders can't be edited.");
    if (input.plannedQty < o.producedQty)
      throw fail("Validation", `Planned quantity can't be less than already produced (${o.producedQty}).`);
    Object.assign(o, input);
    return o;
  },
  setStage(id: string, stage: ProductionStage): ProductionOrder {
    const o = findOrder(id);
    if (o.stage === "on_hold") throw fail("Conflict", "Resume the order before changing its stage.");
    o.stage = stage;
    o.completedOn = stage === "completed" ? today() : undefined;
    return o;
  },
  hold(id: string, reason: string): ProductionOrder {
    const o = findOrder(id);
    if (o.stage === "completed") throw fail("Conflict", "Completed orders can't be put on hold.");
    o.heldFromStage = workingStage(o);
    o.stage = "on_hold";
    o.holdReason = reason;
    return o;
  },
  resume(id: string): ProductionOrder {
    const o = findOrder(id);
    o.stage = o.heldFromStage ?? "planned";
    o.heldFromStage = undefined;
    o.holdReason = undefined;
    return o;
  },
  remove(id: string) {
    const o = findOrder(id);
    if (productionEntries.some((e) => e.orderId === id))
      throw fail("Conflict", "This order has production logged against it. Put it on hold instead of deleting it.");
    productionOrders.splice(productionOrders.indexOf(o), 1);
    return id;
  },
  logEntry(input: EntryInput): ProductionEntry {
    const o = findOrder(input.orderId);
    if (o.stage === "completed") throw fail("Conflict", "This order is already completed.");
    if (input.goodQty + input.wastageQty <= 0) throw fail("Validation", "Enter good pieces or wastage.");
    const e: ProductionEntry = { ...input, id: `pe${Date.now()}`, createdAt: new Date().toISOString() };
    productionEntries.push(e);
    recalc(o);
    // First output moves a planned order onto the floor automatically
    if (o.stage === "planned") o.stage = nextStage(o) ?? o.stage;
    return e;
  },
  deleteEntry(id: string) {
    const i = productionEntries.findIndex((e) => e.id === id);
    if (i === -1) throw fail("NotFound", "Entry no longer exists.");
    const o = findOrder(productionEntries[i]!.orderId);
    if (o.stage === "completed") throw fail("Conflict", "Entries of a completed order are locked.");
    productionEntries.splice(i, 1);
    recalc(o);
    return id;
  },
};

/* ── queries ── */
export const productionKeys = {
  all: ["production"] as const,
  orders: () => [...productionKeys.all, "orders"] as const,
  entries: (orderId: string) => [...productionKeys.all, "entries", orderId] as const,
  customers: () => [...productionKeys.all, "customers"] as const,
};

export const useProductionOrders = () =>
  useQuery({ queryKey: productionKeys.orders(), queryFn: () => command("production_orders_list", undefined, () => productionOrders) });

export const useProductionEntries = (orderId: string | undefined) =>
  useQuery({
    queryKey: productionKeys.entries(orderId ?? ""),
    enabled: !!orderId,
    queryFn: () =>
      command("production_entries_list", { orderId }, () =>
        productionEntries.filter((e) => e.orderId === orderId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      ),
  });

/** Good pieces and wastage logged since the start of the current month. */
export const useMonthOutput = () =>
  useQuery({
    queryKey: [...productionKeys.all, "month-output"],
    queryFn: () =>
      command("production_month_output", undefined, () => {
        const from = format(new Date(), "yyyy-MM-01");
        const month = productionEntries.filter((e) => e.date >= from);
        return { good: month.reduce((s, e) => s + e.goodQty, 0), wastage: month.reduce((s, e) => s + e.wastageQty, 0) };
      }),
  });

/** Customer names seen on previous orders, for the order form's suggestions. */
export const useOrderCustomers = () =>
  useQuery({
    queryKey: productionKeys.customers(),
    queryFn: () => command("production_customers", undefined, () => [...new Set(productionOrders.map((o) => o.customer))].sort()),
  });

/* ── mutations ── */
function useProductionMutation<TArgs, TResult>(name: string, fn: (a: TArgs) => TResult, args: (a: TArgs) => Record<string, unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: TArgs) => command<TResult>(name, args(a), () => fn(a)),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: productionKeys.all }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["alerts"] }),
      ]),
  });
}

export const useCreateOrder = () => useProductionMutation("production_order_create", mock.create, (input) => ({ input }));
export const useUpdateOrder = () =>
  useProductionMutation("production_order_update", (a: { id: string; input: OrderInput }) => mock.update(a.id, a.input), (a) => a);
export const useSetStage = () =>
  useProductionMutation("production_order_set_stage", (a: { id: string; stage: ProductionStage }) => mock.setStage(a.id, a.stage), (a) => a);
export const useHoldOrder = () =>
  useProductionMutation("production_order_hold", (a: { id: string; reason: string }) => mock.hold(a.id, a.reason), (a) => a);
export const useResumeOrder = () => useProductionMutation("production_order_resume", (id: string) => mock.resume(id), (id) => ({ id }));
export const useDeleteOrder = () => useProductionMutation("production_order_delete", (id: string) => mock.remove(id), (id) => ({ id }));
export const useLogEntry = () => useProductionMutation("production_entry_create", mock.logEntry, (input) => ({ input }));
export const useDeleteEntry = () => useProductionMutation("production_entry_delete", (id: string) => mock.deleteEntry(id), (id) => ({ id }));
