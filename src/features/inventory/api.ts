import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { command } from "@/lib/ipc";
import { paperPerBox } from "@/lib/production";
import { materials, parties, productionEntries, productionOrders, stockMovements, transactions } from "@/data/mock/seed";
import type { AdjustmentReason, Material, MaterialCategory, PaymentMode, StockMovement } from "@/types/domain";

/* ── DTOs ── */
export type StockStatus = "ok" | "low" | "out";
export interface MaterialRow extends Material {
  status: StockStatus;
  value: number;
  lastInward?: string;
  issuedThisMonth: number;
}

export interface MaterialInput {
  name: string;
  code: string;
  category: MaterialCategory;
  unit: Material["unit"];
  reorderLevel: number;
  gsm?: number;
  bf?: number;
  deckleInch?: number;
  preferredVendorId?: string;
  notes?: string;
}

export interface InwardInput {
  materialId: string;
  date: string;
  qty: number;
  rate: number; // paise per unit
  vendorId?: string;
  billNo?: string;
  reels?: number;
  note?: string;
  /** Also record the purchase payment in the cash book */
  payNow?: { mode: PaymentMode };
}
export interface IssueInput { materialId: string; date: string; qty: number; orderId?: string; note?: string }
export interface AdjustInput { materialId: string; date: string; newStock: number; reason: AdjustmentReason; note?: string }

export interface ConsumptionReport {
  byMaterial: { materialId: string; code: string; name: string; unit: string; inward: number; issued: number; value: number }[];
  byOrder: { orderId: string; orderNo: string; customer: string; product: string; issuedKg: number; value: number; expectedKg: number; variancePct: number | null }[];
}

export const CATEGORIES: MaterialCategory[] = ["Paper Roll", "Gum & Adhesive", "Ink", "Stitching Wire", "Strapping", "Consumable"];
export const ADJUST_REASONS: Record<AdjustmentReason, string> = {
  stock_count: "Physical stock count",
  damage: "Damaged / unusable",
  moisture_loss: "Moisture / weight loss",
  return_to_vendor: "Returned to vendor",
  other: "Other",
};

const fail = (kind: string, message: string) => ({ kind, message });
const today = () => format(new Date(), "yyyy-MM-dd");
const statusOf = (m: Material): StockStatus => (m.stock <= 0 ? "out" : m.stock <= m.reorderLevel ? "low" : "ok");

/* ── ledger engine (mirrors what the Rust side will do inside a transaction) ── */
function findMaterial(id: string) {
  const m = materials.find((x) => x.id === id);
  if (!m) throw fail("NotFound", "Material not found.");
  return m;
}

/**
 * Replays a material's ledger in date order, recomputing running balance and
 * weighted-average cost. Back-dated entries are allowed as long as the
 * balance never goes negative on any day.
 */
function rebuild(materialId: string) {
  const list = stockMovements
    .filter((s) => s.materialId === materialId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  let bal = 0;
  let avg = 0;
  for (const mv of list) {
    if (mv.type === "opening" || mv.type === "inward") {
      avg = bal + mv.qty > 0 ? Math.round((bal * avg + mv.qty * mv.rate) / (bal + mv.qty)) : mv.rate;
    } else {
      mv.rate = avg;
      mv.value = mv.qty * avg;
    }
    bal += mv.qty;
    if (bal < 0) return { ok: false as const, date: mv.date };
    mv.balanceAfter = bal;
  }
  const m = findMaterial(materialId);
  m.stock = bal;
  m.avgCost = avg;
  return { ok: true as const };
}

function insert(mv: StockMovement) {
  stockMovements.push(mv);
  const res = rebuild(mv.materialId);
  if (!res.ok) {
    stockMovements.splice(stockMovements.indexOf(mv), 1);
    rebuild(mv.materialId);
    throw fail("Validation", `Not enough stock: the balance would go below zero on ${res.date}. Record the inward first or check the quantity.`);
  }
  return mv;
}

const newId = () => `sm${Date.now()}${Math.floor(Math.random() * 1000)}`;

const mock = {
  materials(): MaterialRow[] {
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    return materials.map((m) => {
      const mvs = stockMovements.filter((s) => s.materialId === m.id);
      return {
        ...m,
        status: statusOf(m),
        value: Math.round(m.stock * m.avgCost),
        lastInward: mvs.filter((s) => s.type === "inward").reduce<string | undefined>((d, s) => (!d || s.date > d ? s.date : d), undefined),
        issuedThisMonth: -mvs.filter((s) => s.type === "issue" && s.date >= monthStart).reduce((a, s) => a + s.qty, 0) || 0,
      };
    });
  },

  movements(materialId?: string): StockMovement[] {
    return stockMovements
      .filter((s) => !materialId || s.materialId === materialId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  createMaterial(input: MaterialInput): Material {
    if (materials.some((m) => m.code.toLowerCase() === input.code.toLowerCase())) throw fail("Conflict", `Code ${input.code} is already used.`);
    const m: Material = { ...input, id: `m${Date.now()}`, stock: 0, avgCost: 0, active: true };
    materials.push(m);
    return m;
  },

  updateMaterial(id: string, input: MaterialInput): Material {
    const m = findMaterial(id);
    if (materials.some((x) => x.id !== id && x.code.toLowerCase() === input.code.toLowerCase())) throw fail("Conflict", `Code ${input.code} is already used.`);
    if (input.unit !== m.unit && stockMovements.some((s) => s.materialId === id))
      throw fail("Validation", "The unit can't change once stock has been recorded. Create a new material instead.");
    Object.assign(m, input);
    return m;
  },

  inward(input: InwardInput): StockMovement {
    const m = findMaterial(input.materialId);
    if (input.date > today()) throw fail("Validation", "Inward date can't be in the future.");
    if (input.qty <= 0 || input.rate <= 0) throw fail("Validation", "Quantity and rate must be more than zero.");
    const vendor = parties.find((p) => p.id === input.vendorId);
    const mv: StockMovement = {
      id: newId(), materialId: m.id, date: input.date, type: "inward", qty: input.qty, rate: input.rate, value: Math.round(input.qty * input.rate),
      balanceAfter: 0, vendorId: vendor?.id, vendorName: vendor?.name, billNo: input.billNo, reels: input.reels, note: input.note, createdAt: new Date().toISOString(),
    };
    if (input.payNow) {
      mv.transactionId = `t-${mv.id}`;
      transactions.unshift({
        id: mv.transactionId, date: input.date, direction: "out", amount: mv.value, category: "Raw Material", treatment: "operating", mode: input.payNow.mode,
        partyId: vendor?.id, partyName: vendor?.name, particulars: `Material Purchase – ${m.name}`, reference: input.billNo, source: "manual", createdAt: mv.createdAt,
        origin: { module: "inventory", refId: mv.id },
      });
      transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }
    return insert(mv);
  },

  issue(input: IssueInput): StockMovement {
    const m = findMaterial(input.materialId);
    if (input.date > today()) throw fail("Validation", "Issue date can't be in the future.");
    if (input.qty <= 0) throw fail("Validation", "Quantity must be more than zero.");
    const order = productionOrders.find((o) => o.id === input.orderId);
    return insert({
      id: newId(), materialId: m.id, date: input.date, type: "issue", qty: -input.qty, rate: m.avgCost, value: -input.qty * m.avgCost, balanceAfter: 0,
      orderId: order?.id, orderNo: order?.orderNo, note: input.note || (order ? undefined : "General use"), createdAt: new Date().toISOString(),
    });
  },

  adjust(input: AdjustInput): StockMovement {
    const m = findMaterial(input.materialId);
    if (input.newStock < 0) throw fail("Validation", "Stock can't be negative.");
    if (input.date !== today()) throw fail("Validation", "Adjustments are recorded for today, against the current balance.");
    const diff = input.newStock - m.stock;
    if (diff === 0) throw fail("Validation", "The counted stock matches the system. Nothing to adjust.");
    return insert({
      id: newId(), materialId: m.id, date: input.date, type: "adjustment", qty: diff, rate: m.avgCost, value: diff * m.avgCost, balanceAfter: 0,
      reason: input.reason, note: input.note, createdAt: new Date().toISOString(),
    });
  },

  deleteMovement(id: string) {
    const mv = stockMovements.find((s) => s.id === id);
    if (!mv) throw fail("NotFound", "Entry not found.");
    if (mv.type === "opening") throw fail("Conflict", "The opening balance can't be deleted. Use an adjustment instead.");
    stockMovements.splice(stockMovements.indexOf(mv), 1);
    const res = rebuild(mv.materialId);
    if (!res.ok) {
      stockMovements.push(mv);
      rebuild(mv.materialId);
      throw fail("Conflict", `Deleting this would make stock negative on ${res.date}, because later issues depend on it.`);
    }
    if (mv.transactionId) {
      const t = transactions.findIndex((x) => x.id === mv.transactionId);
      if (t !== -1) transactions.splice(t, 1);
    }
    return id;
  },

  consumption(from: string, to: string): ConsumptionReport {
    const inRange = stockMovements.filter((s) => s.date >= from && s.date <= to);
    const byMaterial = materials.map((m) => {
      const mv = inRange.filter((s) => s.materialId === m.id);
      return {
        materialId: m.id, code: m.code, name: m.name, unit: m.unit,
        inward: mv.filter((s) => s.type === "inward").reduce((a, s) => a + s.qty, 0),
        issued: -mv.filter((s) => s.type === "issue").reduce((a, s) => a + s.qty, 0) || 0,
        value: -mv.filter((s) => s.type === "issue").reduce((a, s) => a + s.value, 0) || 0,
      };
    }).filter((r) => r.inward || r.issued);

    const paperIds = new Set(materials.filter((m) => m.category === "Paper Roll").map((m) => m.id));
    const orderIds = [...new Set(inRange.filter((s) => s.orderId && paperIds.has(s.materialId)).map((s) => s.orderId!))];
    const byOrder = orderIds.map((oid) => {
      const o = productionOrders.find((x) => x.id === oid)!;
      const issued = stockMovements.filter((s) => s.orderId === oid && paperIds.has(s.materialId) && s.type === "issue");
      const issuedKg = -issued.reduce((a, s) => a + s.qty, 0);
      const pieces = productionEntries.filter((e) => e.orderId === oid).reduce((a, e) => a + e.goodQty + e.wastageQty, 0);
      const expectedKg = Math.round((paperPerBox(o.spec) * pieces) / 1000);
      return {
        orderId: oid, orderNo: o.orderNo, customer: o.customer, product: o.product, issuedKg, value: -issued.reduce((a, s) => a + s.value, 0),
        expectedKg, variancePct: expectedKg ? ((issuedKg - expectedKg) / expectedKg) * 100 : null,
      };
    });
    return { byMaterial, byOrder };
  },
};

/* ── hooks ── */
export const inventoryKeys = {
  all: ["inventory"] as const,
  materials: () => [...inventoryKeys.all, "materials"] as const,
  movements: (id?: string) => [...inventoryKeys.all, "movements", id ?? "all"] as const,
  consumption: (from: string, to: string) => [...inventoryKeys.all, "consumption", from, to] as const,
};

export const useMaterials = () => useQuery({ queryKey: inventoryKeys.materials(), queryFn: () => command("materials_list", undefined, mock.materials) });
export const useMovements = (materialId?: string, enabled = true) =>
  useQuery({ queryKey: inventoryKeys.movements(materialId), enabled, queryFn: () => command("stock_movements_list", { materialId }, () => mock.movements(materialId)) });
export const useConsumption = (from: string, to: string) =>
  useQuery({ queryKey: inventoryKeys.consumption(from, to), queryFn: () => command("stock_consumption", { from, to }, () => mock.consumption(from, to)), placeholderData: (p) => p });

function useInventoryMutation<A, R>(name: string, fn: (a: A) => R, args: (a: A) => Record<string, unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: A) => command<R>(name, args(a), () => fn(a)),
    onSuccess: () => Promise.all(["inventory", "alerts", "transactions", "dashboard"].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}

export const useCreateMaterial = () => useInventoryMutation("material_create", mock.createMaterial, (input) => ({ input }));
export const useUpdateMaterial = () =>
  useInventoryMutation("material_update", (a: { id: string; input: MaterialInput }) => mock.updateMaterial(a.id, a.input), (a) => a);
export const useStockInward = () => useInventoryMutation("stock_inward", mock.inward, (input) => ({ input }));
export const useStockIssue = () => useInventoryMutation("stock_issue", mock.issue, (input) => ({ input }));
export const useStockAdjust = () => useInventoryMutation("stock_adjust", mock.adjust, (input) => ({ input }));
export const useDeleteMovement = () => useInventoryMutation("stock_movement_delete", (id: string) => mock.deleteMovement(id), (id) => ({ id }));

export const UNIT_LABEL: Record<Material["unit"], string> = { kg: "kg", roll: "rolls", litre: "L", pcs: "pcs", bag: "bags" };
