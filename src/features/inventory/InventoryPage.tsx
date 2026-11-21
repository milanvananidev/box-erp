import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  History,
  IndianRupee,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Scale,
  Scroll,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatINR, formatQty, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockMovement } from "@/types/domain";
import { UNIT_LABEL, useMaterials, useMovements, type MaterialRow } from "./api";
import { StockStatusBadge } from "./components/StockStatus";
import { MovementBadge, movementDetail } from "./components/MovementBits";
import { AdjustDialog, InwardDialog, IssueDialog } from "./components/StockDialogs";
import { MaterialFormSheet } from "./components/MaterialFormSheet";
import { MaterialDetailSheet } from "./components/MaterialDetailSheet";

type Tab = "stock" | "movements";
type DialogState = { kind: "inward" | "issue" | "adjust"; materialId?: string } | null;

export default function InventoryPage() {
  usePageMeta("Inventory", "Raw materials, paper reels, stock inward and usage");
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "stock";
  const openId = params.get("material");
  const editId = params.get("edit");
  const creating = params.get("new") === "1";

  const [category, setCategory] = useState<string>("all");
  const [moveType, setMoveType] = useState<"all" | StockMovement["type"]>("all");
  const [dialog, setDialog] = useState<DialogState>(
    params.get("inward") === "1" ? { kind: "inward" } : null,
  );

  const patch = useCallback(
    (c: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(c)) v === null ? n.delete(k) : n.set(k, v);
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );

  const mats = useMaterials();
  const moves = useMovements();

  useHotkeys(
    {
      i: () => setDialog({ kind: "inward" }),
      o: () => setDialog({ kind: "issue" }),
    },
    !dialog && !openId && !editId && !creating,
  );

  const rows = useMemo(() => {
    return mats.data?.filter((m) => {
      if (category === "all") return true;
      if (category === "attention") return m.status !== "ok";
      if (category === "paper") return m.category === "Paper Roll";
      if (category === "gum") return m.category === "Gum & Adhesive";
      if (category === "ink") return m.category === "Ink";
      if (category === "other") return !["Paper Roll", "Gum & Adhesive", "Ink"].includes(m.category);
      return m.category === category;
    });
  }, [mats.data, category]);

  const kpi = useMemo(() => {
    const list = mats.data ?? [];
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const month = (moves.data ?? []).filter((s) => s.date >= monthStart);
    return {
      totalValue: list.reduce((s, m) => s + m.value, 0),
      paperKg: list.filter((m) => m.category === "Paper Roll").reduce((s, m) => s + m.stock, 0),
      paperCount: list.filter((m) => m.category === "Paper Roll").length,
      attentionCount: list.filter((m) => m.status !== "ok").length,
      outCount: list.filter((m) => m.status === "out").length,
      inwardValue: month.filter((s) => s.type === "inward").reduce((a, s) => a + s.value, 0),
      issuedValue: -month.filter((s) => s.type === "issue").reduce((a, s) => a + s.value, 0),
    };
  }, [mats.data, moves.data]);

  const columns = useMemo<DataColumn<MaterialRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Material & Specs",
        cell: ({ row: { original: m } }) => {
          const isPaper = m.category === "Paper Roll";
          return (
            <div className="flex flex-col gap-1 py-1">
              <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                {isPaper ? <Scroll className="size-4 text-brand-600 shrink-0" /> : <Package className="size-4 text-muted-foreground shrink-0" />}
                <span>{m.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono bg-subtle px-1.5 py-0.2 rounded border border-border text-[11px] font-medium">
                  {m.code}
                </span>
                {m.gsm && (
                  <span className="bg-amber-50 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200 text-[11px]">
                    {m.gsm} GSM
                  </span>
                )}
                {m.bf && (
                  <span className="bg-amber-50 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200 text-[11px]">
                    {m.bf} BF
                  </span>
                )}
                {m.deckleInch && (
                  <span className="bg-amber-50 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200 text-[11px]">
                    {m.deckleInch}" Deckle
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span>,
      },
      {
        accessorKey: "stock",
        header: "Current Stock",
        meta: { align: "right" },
        cell: ({ row: { original: m } }) => (
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono font-bold text-sm text-foreground">
              {formatQty(m.stock, UNIT_LABEL[m.unit])}
            </div>
            <StockStatusBadge status={m.status} />
          </div>
        ),
      },
      {
        accessorKey: "issuedThisMonth",
        header: "Used This Month",
        meta: { align: "right" },
        cell: ({ row: { original: m } }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {m.issuedThisMonth > 0 ? formatQty(m.issuedThisMonth, UNIT_LABEL[m.unit]) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "avgCost",
        header: "Avg Cost",
        meta: { align: "right" },
        cell: ({ row: { original: m } }) => (
          <div className="font-mono text-xs text-foreground">
            {formatINR(m.avgCost, { precise: true })}
            <span className="text-muted-foreground text-[11px]">/{m.unit}</span>
          </div>
        ),
      },
      {
        accessorKey: "value",
        header: "Total Value",
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="font-mono font-semibold text-foreground text-sm">
            {formatINR(getValue() as number)}
          </span>
        ),
      },
      {
        id: "quickActions",
        header: () => <span className="sr-only">Quick Actions</span>,
        enableSorting: false,
        meta: { align: "right", className: "w-44" },
        cell: ({ row: { original: m } }) => (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs font-semibold text-emerald-700 bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800"
              onClick={() => setDialog({ kind: "inward", materialId: m.id })}
            >
              <Plus className="size-3" /> In
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={m.stock <= 0}
              className="h-7 px-2 text-xs font-semibold text-amber-800 bg-amber-50/70 border-amber-200 hover:bg-amber-100 hover:text-amber-900"
              onClick={() => setDialog({ kind: "issue", materialId: m.id })}
            >
              <ArrowUpFromLine className="size-3" /> Out
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog({ kind: "adjust", materialId: m.id })}>
                  <Scale className="size-3.5" /> Adjust Stock Count
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => patch({ material: m.id })}>
                  <History className="size-3.5" /> View Stock Ledger
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => patch({ edit: m.id })}>
                  <Pencil className="size-3.5" /> Edit Specifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [patch],
  );

  type MoveRow = StockMovement & { materialName: string; unit: string };
  const moveRows = useMemo<MoveRow[] | undefined>(() => {
    if (!moves.data || !mats.data) return undefined;
    const byId = new Map(mats.data.map((m) => [m.id, m]));
    return moves.data
      .filter((s) => moveType === "all" || s.type === moveType)
      .map((s) => ({
        ...s,
        materialName: byId.get(s.materialId)?.name ?? "—",
        unit: UNIT_LABEL[byId.get(s.materialId)?.unit ?? "kg"],
      }));
  }, [moves.data, mats.data, moveType]);

  const moveCols = useMemo<DataColumn<MoveRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ getValue }) => <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(getValue() as string)}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row: { original: s } }) => <MovementBadge type={s.type} />,
      },
      {
        accessorKey: "materialName",
        header: "Material",
        cell: ({ row: { original: s } }) => (
          <button
            className="font-semibold text-foreground text-sm hover:underline text-left cursor-pointer"
            onClick={() => patch({ material: s.materialId })}
          >
            {s.materialName}
          </button>
        ),
      },
      {
        id: "detail",
        header: "Details / Remarks",
        accessorFn: (s) => movementDetail(s),
        cell: ({ getValue }) => <span className="block max-w-72 truncate text-xs text-muted-foreground">{getValue() as string}</span>,
      },
      {
        accessorKey: "qty",
        header: "Quantity",
        meta: { align: "right" },
        cell: ({ row: { original: s } }) => (
          <span
            className={cn(
              "font-mono font-bold text-sm whitespace-nowrap",
              s.qty > 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {s.qty > 0 ? `+${formatQty(s.qty, s.unit)}` : formatQty(s.qty, s.unit)}
          </span>
        ),
      },
      {
        accessorKey: "value",
        header: "Valuation",
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-foreground font-semibold">
            {formatINR(Math.abs(getValue() as number))}
          </span>
        ),
      },
      {
        accessorKey: "balanceAfter",
        header: "Godown Balance",
        meta: { align: "right" },
        cell: ({ row: { original: s } }) => (
          <span className="font-mono text-xs font-medium text-foreground">
            {formatQty(s.balanceAfter, s.unit)}
          </span>
        ),
      },
    ],
    [patch],
  );

  const openMaterial = mats.data?.find((m) => m.id === openId);
  const editMaterial = mats.data?.find((m) => m.id === editId);

  return (
    <div className="flex flex-col gap-5">
      {/* 4 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Stock Value */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Godown Stock Value</span>
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {mats.isLoading ? "—" : formatINR(kpi.totalValue)}
              </div>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <IndianRupee className="size-5 text-[#C98F4F]" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Across {mats.data?.length ?? 0} registered materials
          </div>
        </div>

        {/* Card 2: Paper Reels in Stock */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Paper Reels in Godown</span>
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {mats.isLoading ? "—" : formatQty(kpi.paperKg, "kg")}
              </div>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Scroll className="size-5 text-brand-600" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {kpi.paperCount} paper grades & deckles in stock
          </div>
        </div>

        {/* Card 3: Stock Health */}
        <div
          onClick={() => {
            patch({ tab: null });
            setCategory(kpi.attentionCount > 0 ? "attention" : "all");
          }}
          className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs cursor-pointer transition-all hover:shadow-card ${
            kpi.attentionCount > 0
              ? "border-amber-300/80 bg-amber-50/30"
              : "border-border/80 bg-card"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Stock Alerts</span>
              <div className="text-2xl font-bold tracking-tight font-mono text-foreground flex items-center gap-2">
                {mats.isLoading ? (
                  "—"
                ) : kpi.attentionCount > 0 ? (
                  <span className="text-amber-800">{kpi.attentionCount} Items Low</span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1.5 text-xl font-bold">
                    <CheckCircle2 className="size-5" /> All Healthy
                  </span>
                )}
              </div>
            </div>
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                kpi.attentionCount > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <AlertTriangle className="size-5" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {kpi.outCount > 0 ? `${kpi.outCount} completely out of stock` : "Click to view low stock materials"}
          </div>
        </div>

        {/* Card 4: Month Inward vs Used */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Material Received (Month)</span>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 font-mono">
                {moves.isLoading ? "—" : formatINR(kpi.inwardValue)}
              </div>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowDownToLine className="size-5" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>Used: {formatINR(kpi.issuedValue)}</span>
            <span className="text-brand-600 font-semibold cursor-pointer" onClick={() => patch({ tab: "movements" })}>
              History →
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs and Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Tabs value={tab} onValueChange={(v) => patch({ tab: v === "stock" ? null : v })}>
          <TabsList className="h-10 bg-subtle/80 p-1 rounded-xl border border-border">
            <TabsTrigger value="stock" className="h-8 px-4 font-semibold text-xs rounded-lg cursor-pointer">
              <Warehouse className="size-4" /> Current Stock
            </TabsTrigger>
            <TabsTrigger value="movements" className="h-8 px-4 font-semibold text-xs rounded-lg cursor-pointer">
              <History className="size-4" /> Stock Movements & Log
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => setDialog({ kind: "inward" })}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-3.5 shadow-xs"
          >
            <ArrowDownToLine className="size-4" /> + Stock In (Purchase)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialog({ kind: "issue" })}
            className="border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100 font-semibold text-xs h-9 px-3.5"
          >
            <ArrowUpFromLine className="size-4 text-[#C98F4F]" /> - Stock Out (Usage)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => patch({ new: "1" })}
            className="text-xs h-9 px-3.5 font-medium border-border hover:bg-subtle"
          >
            <Plus className="size-4" /> New Material
          </Button>
        </div>
      </div>

      {/* Tab 1: Current Stock */}
      {tab === "stock" && (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={mats.isLoading}
          error={mats.error}
          onRetry={() => mats.refetch()}
          getRowId={(m) => m.id}
          onRowClick={(m) => patch({ material: m.id })}
          searchPlaceholder="Search material by name, code, GSM, or size…"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["all", "All Materials"],
                ["paper", "Paper Reels"],
                ["gum", "Gum & Adhesive"],
                ["ink", "Inks"],
                ["other", "Wire & Strapping"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setCategory(k)}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-xs font-semibold transition-all cursor-pointer",
                    category === k
                      ? "border-brand-500 bg-brand-50 text-brand-900 shadow-2xs"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}

              {kpi.attentionCount > 0 && (
                <button
                  onClick={() => setCategory(category === "attention" ? "all" : "attention")}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    category === "attention"
                      ? "border-amber-500 bg-amber-100 text-amber-900"
                      : "border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100",
                  )}
                >
                  <AlertTriangle className="size-3.5" />
                  <span>Low Stock ({kpi.attentionCount})</span>
                </button>
              )}
            </div>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={!rows?.length}
              onClick={() => {
                const list = rows ?? [];
                downloadCsv(
                  "godown-stock",
                  [
                    "Code",
                    "Material",
                    "Category",
                    "GSM",
                    "BF",
                    "Deckle (in)",
                    "Stock",
                    "Unit",
                    "Reorder Level",
                    "Avg Cost (INR)",
                    "Value (INR)",
                    "Status",
                  ],
                  list.map((m) => [
                    m.code,
                    m.name,
                    m.category,
                    m.gsm,
                    m.bf,
                    m.deckleInch,
                    m.stock,
                    m.unit,
                    m.reorderLevel,
                    fromPaise(m.avgCost),
                    fromPaise(m.value),
                    m.status,
                  ]),
                );
                toast.success(`Exported ${list.length} materials`);
              }}
            >
              <Download className="size-3.5" /> Export Stock
            </Button>
          }
          empty={{
            title: category === "attention" ? "All materials are well-stocked" : "No materials found",
            description:
              category === "attention"
                ? "There are no raw materials currently below their reorder level."
                : "Add your paper reels and factory consumables to begin tracking stock.",
            action: (
              <Button size="sm" onClick={() => patch({ new: "1" })}>
                <Plus className="size-3.5" /> Add First Material
              </Button>
            ),
          }}
        />
      )}

      {/* Tab 2: Stock Movements & Audit Ledger */}
      {tab === "movements" && (
        <DataTable
          columns={moveCols}
          data={moveRows}
          isLoading={moves.isLoading}
          error={moves.error}
          onRetry={() => moves.refetch()}
          getRowId={(s) => s.id}
          initialSort={[{ id: "date", desc: true }]}
          searchPlaceholder="Search movement by material, vendor, bill, or note…"
          toolbar={
            <Tabs value={moveType} onValueChange={(v) => setMoveType(v as typeof moveType)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs cursor-pointer">
                  All Activity
                </TabsTrigger>
                <TabsTrigger value="inward" className="text-xs cursor-pointer text-emerald-700">
                  Stock In
                </TabsTrigger>
                <TabsTrigger value="issue" className="text-xs cursor-pointer text-amber-800">
                  Stock Out
                </TabsTrigger>
                <TabsTrigger value="adjustment" className="text-xs cursor-pointer">
                  Adjustments
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={!moveRows?.length}
              onClick={() => {
                const list = moveRows ?? [];
                downloadCsv(
                  "stock-movements",
                  [
                    "Date",
                    "Type",
                    "Material",
                    "Details",
                    "Quantity",
                    "Unit",
                    "Rate (INR)",
                    "Value (INR)",
                    "Balance After",
                  ],
                  list.map((s) => [
                    s.date,
                    s.type,
                    s.materialName,
                    movementDetail(s),
                    s.qty,
                    s.unit,
                    fromPaise(s.rate),
                    fromPaise(s.value),
                    s.balanceAfter,
                  ]),
                );
                toast.success(`Exported ${list.length} movements`);
              }}
            >
              <Download className="size-3.5" /> Export Log
            </Button>
          }
          empty={{ title: "No stock movements recorded yet" }}
        />
      )}

      {/* Material Detail Sheet */}
      <MaterialDetailSheet
        material={openMaterial}
        onClose={() => patch({ material: null })}
        onInward={() => setDialog({ kind: "inward", materialId: openId! })}
        onIssue={() => setDialog({ kind: "issue", materialId: openId! })}
        onAdjust={() => setDialog({ kind: "adjust", materialId: openId! })}
        onEdit={() => patch({ material: null, edit: openId })}
      />

      {/* Add / Edit Material Sheet */}
      <MaterialFormSheet
        open={creating || !!editMaterial}
        material={editMaterial}
        onClose={() => patch({ new: null, edit: null })}
      />

      {/* Stock In, Stock Out, Stock Adjust Dialogs */}
      <InwardDialog
        open={dialog?.kind === "inward"}
        materialId={dialog?.materialId}
        onOpenChange={(v) => {
          if (!v) {
            setDialog(null);
            patch({ inward: null });
          }
        }}
      />
      <IssueDialog
        open={dialog?.kind === "issue"}
        materialId={dialog?.materialId}
        onOpenChange={(v) => !v && setDialog(null)}
      />
      <AdjustDialog
        open={dialog?.kind === "adjust"}
        materialId={dialog?.materialId}
        onOpenChange={(v) => !v && setDialog(null)}
      />
    </div>
  );
}
