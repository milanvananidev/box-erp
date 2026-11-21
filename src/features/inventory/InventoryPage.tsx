import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Download, History, IndianRupee, MoreHorizontal, PackagePlus, Pencil, PieChart, Plus, Scale, Warehouse } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatINR, formatQty, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockMovement } from "@/types/domain";
import { CATEGORIES, UNIT_LABEL, useMaterials, useMovements, type MaterialRow } from "./api";
import { StockStatusBadge } from "./components/StockStatus";
import { MovementBadge, movementDetail } from "./components/MovementBits";
import { AdjustDialog, InwardDialog, IssueDialog } from "./components/StockDialogs";
import { MaterialFormSheet } from "./components/MaterialFormSheet";
import { MaterialDetailSheet } from "./components/MaterialDetailSheet";
import { ConsumptionPanel } from "./components/ConsumptionPanel";

type Tab = "stock" | "movements" | "consumption";
type DialogState = { kind: "inward" | "issue" | "adjust"; materialId?: string } | null;

export default function InventoryPage() {
  usePageMeta("Inventory", "Raw materials, stock movements and consumption");
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "stock";
  const openId = params.get("material");
  const editId = params.get("edit");
  const creating = params.get("new") === "1";
  const [category, setCategory] = useState<string>("all");
  const [moveType, setMoveType] = useState<"all" | StockMovement["type"]>("all");
  const [dialog, setDialog] = useState<DialogState>(params.get("inward") === "1" ? { kind: "inward" } : null);

  const patch = useCallback(
    (c: Record<string, string | null>) =>
      setParams((prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(c)) v === null ? n.delete(k) : n.set(k, v);
        return n;
      }, { replace: true }),
    [setParams],
  );

  const mats = useMaterials();
  const moves = useMovements(); // also feeds the KPI cards on every tab
  useHotkeys({ i: () => setDialog({ kind: "inward" }), o: () => setDialog({ kind: "issue" }) }, !dialog && !openId && !editId && !creating);

  const rows = useMemo(() => mats.data?.filter((m) => category === "all" || (category === "attention" ? m.status !== "ok" : m.category === category)), [mats.data, category]);

  const kpi = useMemo(() => {
    const list = mats.data ?? [];
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const month = (moves.data ?? []).filter((s) => s.date >= monthStart);
    return {
      value: list.reduce((s, m) => s + m.value, 0),
      paperKg: list.filter((m) => m.category === "Paper Roll").reduce((s, m) => s + m.stock, 0),
      attention: list.filter((m) => m.status !== "ok").length,
      out: list.filter((m) => m.status === "out").length,
      inward: month.filter((s) => s.type === "inward").reduce((a, s) => a + s.value, 0),
      issued: -month.filter((s) => s.type === "issue").reduce((a, s) => a + s.value, 0),
    };
  }, [mats.data, moves.data]);

  const columns = useMemo<DataColumn<MaterialRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Material",
        cell: ({ row: { original: m } }) => (
          <div>
            <div className="font-medium">{m.name}</div>
            <div className="text-xs text-muted-foreground">
              {m.code}{m.gsm ? ` · ${m.gsm} GSM` : ""}{m.bf ? ` · ${m.bf} BF` : ""}{m.deckleInch ? ` · ${m.deckleInch}"` : ""}
            </div>
          </div>
        ),
      },
      { accessorKey: "category", header: "Category", cell: ({ getValue }) => <span className="text-[#475467]">{getValue() as string}</span> },
      {
        accessorKey: "stock",
        header: "In stock",
        meta: { align: "right" },
        cell: ({ row: { original: m } }) => {
          const pct = m.reorderLevel ? Math.min(100, (m.stock / (m.reorderLevel * 2)) * 100) : 100;
          return (
            <div>
              <div className="font-semibold">{formatQty(m.stock, UNIT_LABEL[m.unit])}</div>
              <Hint label={`Reorder at ${formatQty(m.reorderLevel, UNIT_LABEL[m.unit])}`}>
                <div className="relative mt-1 ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", m.status === "ok" ? "bg-success" : m.status === "low" ? "bg-warning" : "bg-danger")} style={{ width: `${pct}%` }} />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
                </div>
              </Hint>
            </div>
          );
        },
      },
      { accessorKey: "issuedThisMonth", header: "Used (month)", meta: { align: "right" }, cell: ({ row: { original: m } }) => <span className="text-[#475467]">{formatQty(m.issuedThisMonth, UNIT_LABEL[m.unit])}</span> },
      { accessorKey: "avgCost", header: "Avg cost", meta: { align: "right" }, cell: ({ row: { original: m } }) => <span>{formatINR(m.avgCost, { precise: true })}<span className="text-muted-foreground">/{m.unit}</span></span> },
      { accessorKey: "value", header: "Value", meta: { align: "right" }, cell: ({ getValue }) => <span className="font-medium">{formatINR(getValue() as number)}</span> },
      { accessorKey: "status", header: "Status", cell: ({ row: { original: m } }) => <StockStatusBadge status={m.status} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right", className: "w-12" },
        cell: ({ row: { original: m } }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => setDialog({ kind: "inward", materialId: m.id })}><ArrowDownToLine /> Inward</DropdownMenuItem>
              <DropdownMenuItem disabled={m.stock <= 0} onSelect={() => setDialog({ kind: "issue", materialId: m.id })}><ArrowUpFromLine /> Issue to production</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog({ kind: "adjust", materialId: m.id })}><Scale /> Adjust stock</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => patch({ material: m.id })}><History /> Stock ledger</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => patch({ edit: m.id })}><Pencil /> Edit material</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      .map((s) => ({ ...s, materialName: byId.get(s.materialId)?.name ?? "—", unit: UNIT_LABEL[byId.get(s.materialId)?.unit ?? "kg"] }));
  }, [moves.data, mats.data, moveType]);

  const moveCols = useMemo<DataColumn<MoveRow>[]>(
    () => [
      { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="text-[#475467]">{formatDate(getValue() as string)}</span> },
      { accessorKey: "type", header: "Type", cell: ({ row: { original: s } }) => <MovementBadge type={s.type} /> },
      { accessorKey: "materialName", header: "Material", cell: ({ row: { original: s } }) => <button className="font-medium hover:underline" onClick={() => patch({ material: s.materialId })}>{s.materialName}</button> },
      { id: "detail", header: "Details", accessorFn: (s) => movementDetail(s), cell: ({ getValue }) => <span className="block max-w-64 truncate text-[13px] text-muted-foreground">{getValue() as string}</span> },
      { accessorKey: "qty", header: "Quantity", meta: { align: "right" }, cell: ({ row: { original: s } }) => <span className={cn("font-medium", s.qty > 0 ? "text-success-foreground" : "")}>{s.qty > 0 ? "+" : "−"}{formatQty(Math.abs(s.qty), s.unit)}</span> },
      { accessorKey: "value", header: "Value", meta: { align: "right" }, cell: ({ getValue }) => formatINR(Math.abs(getValue() as number)) },
    ],
    [patch],
  );

  const openMaterial = mats.data?.find((m) => m.id === openId);
  const editMaterial = mats.data?.find((m) => m.id === editId);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Stock Value" icon={IndianRupee} tone="brand" loading={mats.isLoading} value={formatINR(kpi.value)} footnote={`${formatQty(kpi.paperKg, "kg")} of paper`} />
        <StatCard label="Needs Reorder" icon={AlertTriangle} tone={kpi.attention ? "danger" : "success"} loading={mats.isLoading} value={kpi.attention}
          footnote={kpi.out ? `${kpi.out} out of stock` : "At or below reorder level"} onClick={() => { patch({ tab: null }); setCategory("attention"); }} />
        <StatCard label="Received This Month" icon={ArrowDownToLine} tone="success" loading={moves.isLoading} value={formatINR(kpi.inward)} footnote="Inward value" />
        <StatCard label="Used This Month" icon={ArrowUpFromLine} tone="info" loading={moves.isLoading} value={formatINR(kpi.issued)} footnote="Issued at average cost" onClick={() => patch({ tab: "consumption" })} />
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => patch({ tab: v === "stock" ? null : v })}>
          <TabsList className="h-10">
            <TabsTrigger value="stock" className="h-8 px-4"><Warehouse className="size-4" /> Stock</TabsTrigger>
            <TabsTrigger value="movements" className="h-8 px-4"><History className="size-4" /> Movements</TabsTrigger>
            <TabsTrigger value="consumption" className="h-8 px-4"><PieChart className="size-4" /> Consumption</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Hint label="Press O"><Button variant="outline" onClick={() => setDialog({ kind: "issue" })}><ArrowUpFromLine /> Issue</Button></Hint>
          <Hint label="Press I"><Button onClick={() => setDialog({ kind: "inward" })}><PackagePlus /> Material inward</Button></Hint>
        </div>
      </div>

      {tab === "stock" && (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={mats.isLoading}
          error={mats.error}
          onRetry={() => mats.refetch()}
          getRowId={(m) => m.id}
          onRowClick={(m) => patch({ material: m.id })}
          searchPlaceholder="Search material, code, GSM…"
          toolbar={
            <div className="flex flex-wrap gap-1.5">
              {[["all", "All"], ["attention", "Needs reorder"], ...CATEGORIES.map((c) => [c, c])].map(([k, label]) => (
                <button key={k} onClick={() => setCategory(k!)}
                  className={cn("h-8 rounded-full border px-3 text-[13px] font-medium transition-colors", category === k ? "border-brand-400 bg-brand-50 text-brand-800" : "border-border text-[#475467] hover:bg-muted")}>
                  {label}
                </button>
              ))}
            </div>
          }
          actions={
            <>
              <Button variant="outline" disabled={!rows?.length} onClick={() => {
                const list = rows ?? [];
                downloadCsv("stock", ["Code", "Material", "Category", "GSM", "BF", "Deckle (in)", "Stock", "Unit", "Reorder level", "Avg cost (INR)", "Value (INR)", "Status"],
                  list.map((m) => [m.code, m.name, m.category, m.gsm, m.bf, m.deckleInch, m.stock, m.unit, m.reorderLevel, fromPaise(m.avgCost), fromPaise(m.value), m.status]));
                toast.success(`Exported ${list.length} materials`);
              }}><Download /> Export</Button>
              <Button variant="outline" onClick={() => patch({ new: "1" })}><Plus /> New material</Button>
            </>
          }
          empty={{ title: category === "attention" ? "Nothing needs reordering" : "No materials", description: category === "attention" ? "All materials are above their reorder level." : undefined, action: category === "all" ? <Button size="sm" onClick={() => patch({ new: "1" })}><Plus /> New material</Button> : undefined }}
        />
      )}

      {tab === "movements" && (
        <DataTable
          columns={moveCols}
          data={moveRows}
          isLoading={moves.isLoading}
          error={moves.error}
          onRetry={() => moves.refetch()}
          getRowId={(s) => s.id}
          initialSort={[{ id: "date", desc: true }]}
          searchPlaceholder="Search material, vendor, bill, order…"
          toolbar={
            <Tabs value={moveType} onValueChange={(v) => setMoveType(v as typeof moveType)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="inward">Inward</TabsTrigger>
                <TabsTrigger value="issue">Issue</TabsTrigger>
                <TabsTrigger value="adjustment">Adjustments</TabsTrigger>
              </TabsList>
            </Tabs>
          }
          actions={
            <Button variant="outline" disabled={!moveRows?.length} onClick={() => {
              const list = moveRows ?? [];
              downloadCsv("stock-movements", ["Date", "Type", "Material", "Details", "Quantity", "Unit", "Rate (INR)", "Value (INR)", "Balance after"],
                list.map((s) => [s.date, s.type, s.materialName, movementDetail(s), s.qty, s.unit, fromPaise(s.rate), fromPaise(s.value), s.balanceAfter]));
              toast.success(`Exported ${list.length} movements`);
            }}><Download /> Export</Button>
          }
          empty={{ title: "No stock movements" }}
        />
      )}

      {tab === "consumption" && <ConsumptionPanel />}

      <MaterialDetailSheet
        material={openMaterial}
        onClose={() => patch({ material: null })}
        onInward={() => setDialog({ kind: "inward", materialId: openId! })}
        onIssue={() => setDialog({ kind: "issue", materialId: openId! })}
        onAdjust={() => setDialog({ kind: "adjust", materialId: openId! })}
        onEdit={() => patch({ material: null, edit: openId })}
      />
      <MaterialFormSheet open={creating || !!editMaterial} material={editMaterial} onClose={() => patch({ new: null, edit: null })} />
      <InwardDialog open={dialog?.kind === "inward"} materialId={dialog?.materialId} onOpenChange={(v) => { if (!v) { setDialog(null); patch({ inward: null }); } }} />
      <IssueDialog open={dialog?.kind === "issue"} materialId={dialog?.materialId} onOpenChange={(v) => !v && setDialog(null)} />
      <AdjustDialog open={dialog?.kind === "adjust"} materialId={dialog?.materialId} onOpenChange={(v) => !v && setDialog(null)} />
    </div>
  );
}
