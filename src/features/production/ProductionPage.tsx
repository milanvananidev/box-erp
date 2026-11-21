import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowRight, CalendarClock, ClipboardList, Download, Eye, Flame, MoreHorizontal, Package, Pencil, Play, Plus, Recycle } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { StageBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hint } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatPercent, formatQty } from "@/lib/format";
import { STAGE_LABEL, formatSize, isActive, nextStage } from "@/lib/production";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";
import type { ProductionOrder, ProductionStage } from "@/types/domain";
import { useMonthOutput, useProductionOrders, useResumeOrder, useSetStage } from "./api";
import { StagePipeline } from "./components/StagePipeline";
import { OrderFormSheet } from "./components/OrderFormSheet";
import { DueText, OrderDetailSheet } from "./components/OrderDetailSheet";

type View = "active" | "completed" | "all";

/** Urgent first, then earliest due date. */
const byUrgency = (a: ProductionOrder, b: ProductionOrder) =>
  Number(b.priority === "urgent") - Number(a.priority === "urgent") || a.dueDate.localeCompare(b.dueDate);

export default function ProductionPage() {
  usePageMeta("Production", "Orders, shop-floor stages and wastage");
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as View | null) ?? "active";
  const stageFilter = params.get("stage") as ProductionStage | null;
  const openId = params.get("order");
  const editId = params.get("edit");
  const creating = params.get("new") === "1";

  const { data, isLoading, error, refetch } = useProductionOrders();
  const setStage = useSetStage();
  const resume = useResumeOrder();
  const month = useMonthOutput();

  const patch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) v === null ? next.delete(k) : next.set(k, v);
    setParams(next, { replace: true });
  };
  useHotkeys({ n: () => patch({ new: "1" }) }, !openId && !editId && !creating);

  const orders = useMemo(() => (data ? [...data].sort(byUrgency) : undefined), [data]);
  const active = useMemo(() => orders?.filter(isActive), [orders]);
  const rows = useMemo(() => {
    if (!orders) return undefined;
    return orders.filter(
      (o) =>
        (view === "all" || (view === "active" ? isActive(o) : o.stage === "completed")) &&
        (!stageFilter || o.stage === stageFilter),
    );
  }, [orders, view, stageFilter]);

  const kpi = useMemo(() => {
    if (!active || !month.data) return null;
    const soon = format(new Date(Date.now() + 2 * 864e5), "yyyy-MM-dd");
    const { good, wastage: waste } = month.data;
    return {
      active: active.length,
      urgent: active.filter((o) => o.priority === "urgent").length,
      dueSoon: active.filter((o) => o.dueDate <= soon).length,
      overdue: active.filter((o) => o.dueDate < format(new Date(), "yyyy-MM-dd")).length,
      good,
      wastePct: good + waste > 0 ? (waste / (good + waste)) * 100 : 0,
    };
  }, [active, month.data]);

  const advance = async (o: ProductionOrder) => {
    const next = nextStage(o);
    if (!next) return;
    if (next === "completed") return patch({ order: o.id }); // completion goes through the detail view (short-qty check)
    try {
      await setStage.mutateAsync({ id: o.id, stage: next });
      toast.success(`${o.orderNo} moved to ${STAGE_LABEL[next]}`);
    } catch (e) {
      toast.error("Couldn't change stage", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const columns = useMemo<DataColumn<ProductionOrder>[]>(
    () => [
      {
        accessorKey: "orderNo",
        header: "Order",
        cell: ({ row: { original: o } }) => (
          <div>
            <div className="flex items-center gap-1.5 font-semibold">
              {o.orderNo}
              {o.priority === "urgent" && o.stage !== "completed" && (
                <Hint label="Urgent"><Flame className="size-3.5 text-danger" /></Hint>
              )}
            </div>
            <Hint label={`Due ${formatDate(o.dueDate)}`}><span><DueText order={o} /></span></Hint>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer / Product",
        accessorFn: (o) => `${o.customer} ${o.product} ${o.customerRef ?? ""}`,
        cell: ({ row: { original: o } }) => (
          <div className="max-w-48">
            <div className="truncate font-medium">{o.customer}</div>
            <div className="truncate text-xs text-muted-foreground">{o.product}{o.customerRef ? ` · ${o.customerRef}` : ""}</div>
          </div>
        ),
      },
      {
        id: "spec",
        header: "Specification",
        enableSorting: false,
        accessorFn: (o) => `${o.spec.ply} ply ${o.spec.flute} ${formatSize(o.spec)}`,
        cell: ({ row: { original: o } }) => (
          <div className="text-[13px]">
            <div>{formatSize(o.spec)}</div>
            <div className="text-xs text-muted-foreground">
              {o.spec.ply} ply · {o.spec.flute} · {o.spec.gsm} GSM{o.spec.printed ? ` · ${o.spec.colors ?? 1}C print` : ""}
            </div>
          </div>
        ),
      },
      {
        id: "progress",
        header: "Progress",
        meta: { align: "right" },
        accessorFn: (o) => o.producedQty / o.plannedQty,
        cell: ({ row: { original: o } }) => {
          const pct = Math.min(100, (o.producedQty / o.plannedQty) * 100);
          return (
            <div>
              <div className="tabular">
                {formatQty(o.producedQty)} <span className="text-muted-foreground">/ {formatQty(o.plannedQty)}</span>
              </div>
              <div className="mt-1 ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", o.stage === "completed" ? "bg-success" : "bg-brand-500")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        },
      },
      {
        id: "wastage",
        header: "Wastage",
        meta: { align: "right" },
        accessorFn: (o) => (o.producedQty + o.wastageQty ? o.wastageQty / (o.producedQty + o.wastageQty) : 0),
        cell: ({ row: { original: o }, getValue }) => {
          const p = (getValue() as number) * 100;
          return o.producedQty + o.wastageQty === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="tabular">
              <div className={cn(p > 3 && "font-medium text-danger-foreground")}>{formatPercent(p)}</div>
              <div className="text-xs text-muted-foreground">{formatQty(o.wastageQty)} pcs</div>
            </div>
          );
        },
      },
      { accessorKey: "stage", header: "Stage", cell: ({ row: { original: o } }) => <StageBadge stage={o.stage} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right", className: "w-12" },
        cell: ({ row: { original: o } }) => {
          const next = nextStage(o);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${o.orderNo}`} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onSelect={() => patch({ order: o.id })}><Eye /> Open & log output</DropdownMenuItem>
                {o.stage !== "completed" && <DropdownMenuItem onSelect={() => patch({ edit: o.id })}><Pencil /> Edit order</DropdownMenuItem>}
                {o.stage === "on_hold" ? (
                  <DropdownMenuItem onSelect={async () => {
                    try { await resume.mutateAsync(o.id); toast.success(`${o.orderNo} resumed`); } catch (e) { toast.error("Couldn't resume", { description: e instanceof Error ? e.message : undefined }); }
                  }}><Play /> Resume</DropdownMenuItem>
                ) : (
                  next && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => advance(o)}><ArrowRight /> Move to {STAGE_LABEL[next]}</DropdownMenuItem>
                    </>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [params],
  );

  const exportRows = (list: ProductionOrder[]) => {
    downloadCsv(
      "production-orders",
      ["Order No", "Customer", "Customer Ref", "Product", "Ply", "Flute", "GSM", "L (mm)", "W (mm)", "H (mm)", "Printed", "Planned", "Produced", "Wastage", "Wastage %", "Stage", "Priority", "Start", "Due", "Completed"],
      list.map((o) => [
        o.orderNo, o.customer, o.customerRef, o.product, o.spec.ply, o.spec.flute, o.spec.gsm, o.spec.lengthMm, o.spec.widthMm, o.spec.heightMm,
        o.spec.printed ? `${o.spec.colors ?? 1} colour` : "Plain", o.plannedQty, o.producedQty, o.wastageQty,
        o.producedQty + o.wastageQty ? ((o.wastageQty / (o.producedQty + o.wastageQty)) * 100).toFixed(2) : "",
        STAGE_LABEL[o.stage], o.priority, o.startDate, o.dueDate, o.completedOn,
      ]),
    );
    toast.success(`Exported ${list.length} orders`);
  };

  const openOrder = data?.find((o) => o.id === openId);
  const editOrder = data?.find((o) => o.id === editId);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Orders" icon={ClipboardList} tone="brand" loading={!kpi} value={kpi?.active}
          footnote={kpi && (kpi.urgent ? `${kpi.urgent} urgent` : "None urgent")} onClick={() => patch({ view: null, stage: null })} />
        <StatCard label="Due in 2 Days" icon={CalendarClock} tone={kpi?.overdue ? "danger" : "info"} loading={!kpi} value={kpi?.dueSoon}
          footnote={kpi && (kpi.overdue ? `${kpi.overdue} overdue` : "Nothing overdue")} />
        <StatCard label="Produced This Month" icon={Package} tone="success" loading={!kpi} value={kpi && formatQty(kpi.good, "pcs")} footnote="Good pieces logged" />
        <StatCard label="Wastage This Month" icon={Recycle} tone="violet" loading={!kpi} value={kpi && formatPercent(kpi.wastePct)} footnote="Target under 3%" />
      </div>

      <StagePipeline orders={active ?? (orders && [])} value={stageFilter} onChange={(s) => patch({ stage: s, view: s ? "active" : view === "active" ? null : view })} />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        getRowId={(o) => o.id}
        onRowClick={(o) => patch({ order: o.id })}
        searchPlaceholder="Search order no., customer, product, size…"
        toolbar={
          <>
            <Tabs value={view} onValueChange={(v) => patch({ view: v === "active" ? null : v, stage: null })}>
              <TabsList>
                <TabsTrigger value="active">In progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            {stageFilter && (
              <Button variant="soft" size="sm" onClick={() => patch({ stage: null })}>
                Stage: {STAGE_LABEL[stageFilter]} ✕
              </Button>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" disabled={!rows?.length} onClick={() => rows && exportRows(rows)}><Download /> Export</Button>
            <Hint label="Press N">
              <Button onClick={() => patch({ new: "1" })}><Plus /> New order</Button>
            </Hint>
          </>
        }
        empty={{
          title: view === "completed" ? "No completed orders yet" : "No orders here",
          description: stageFilter ? `No orders at ${STAGE_LABEL[stageFilter]} right now.` : "Create a production order to plan work for the shop floor.",
          action: <Button size="sm" onClick={() => patch({ new: "1" })}><Plus /> New order</Button>,
        }}
      />

      <OrderDetailSheet
        order={openOrder}
        onClose={() => patch({ order: null })}
        onEdit={(o) => patch({ order: null, edit: o.id })}
      />
      <OrderFormSheet
        open={creating || !!editOrder}
        order={editOrder}
        onClose={() => patch({ new: null, edit: null })}
        onSaved={(o) => patch({ new: null, edit: null, order: o.id })}
      />
    </div>
  );
}
