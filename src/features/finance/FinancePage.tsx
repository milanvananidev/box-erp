import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { downloadXlsx } from "@/lib/xlsx";
import { Download, MoreHorizontal, Plus, Trash2, FileInput } from "lucide-react";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { StatCard } from "@/components/shared/StatCard";
import { ArrowDownToLine, ArrowUpRight, Scale } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { useUI } from "@/stores/ui";
import { cn } from "@/lib/utils";
import type { Direction, PaymentMode, Transaction } from "@/types/domain";
import { useDeleteTransaction, useTransactions } from "./api";
import { DirectionIcon, ModeBadge, OriginTag, SourceTag, modeLabel } from "./components/badges";
import { ImportVyaparDialog } from "./components/ImportVyaparDialog";

type Period = "this_month" | "last_month" | "last_30" | "last_90" | "all";
const periods: Record<Period, string> = {
  this_month: "This month",
  last_month: "Last month",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  all: "All time",
};

function periodRange(p: Period): [string, string] | null {
  const now = new Date();
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  switch (p) {
    case "this_month": return [f(startOfMonth(now)), f(now)];
    case "last_month": { const m = subMonths(now, 1); return [f(startOfMonth(m)), f(endOfMonth(m))]; }
    case "last_30": return [f(subDays(now, 29)), f(now)];
    case "last_90": return [f(subDays(now, 89)), f(now)];
    case "all": return null;
  }
}

async function exportTransactions(rows: Transaction[]) {
  await downloadXlsx(
    "transactions",
    [
      {
        name: "Transactions",
        headers: ["Date", "Type", "Category", "Particulars", "Party", "Mode", "Reference", "Source", "Amount (INR)"],
        rows: rows.map((t) => [
          t.date,
          t.direction === "in" ? "Income" : "Expense",
          t.category,
          t.particulars,
          t.partyName ?? "",
          modeLabel[t.mode],
          t.reference ?? t.externalRef ?? "",
          t.source,
          (t.direction === "in" ? 1 : -1) * (t.amount / 100),
        ]),
      },
    ],
    "BoxERP Cash Book"
  );
  toast.success(`Exported ${rows.length} transactions`);
}

export default function FinancePage() {
  usePageMeta("Income & Expenses", "Cash, bank and UPI movements");
  const [params, setParams] = useSearchParams();
  const direction = (params.get("direction") as Direction | null) ?? "all";
  const [period, setPeriod] = useState<Period>("this_month");
  const [mode, setMode] = useState<PaymentMode | "all">("all");
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [showVyaparImport, setShowVyaparImport] = useState(false);

  const { data, isLoading, error, refetch } = useTransactions();
  const del = useDeleteTransaction();
  const openTxn = useUI((s) => s.openTxnSheet);

  const filtered = useMemo(() => {
    if (!data) return undefined;
    const range = periodRange(period);
    return data.filter(
      (t) =>
        !t.matchedTo &&
        (direction === "all" || t.direction === direction) &&
        (mode === "all" || t.mode === mode) &&
        (!range || (t.date >= range[0] && t.date <= range[1])),
    );
  }, [data, period, direction, mode]);

  const totals = useMemo(() => {
    const range = periodRange(period);
    const inRange = (data ?? []).filter((t) => !t.matchedTo && (!range || (t.date >= range[0] && t.date <= range[1])) && (mode === "all" || t.mode === mode));
    const inn = inRange.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    const out = inRange.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
    return { inn, out, net: inn - out };
  }, [data, period, mode]);

  const columns = useMemo<DataColumn<Transaction>[]>(
    () => [
      { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="text-[#475467]">{formatDate(getValue() as string)}</span> },
      {
        accessorKey: "particulars",
        header: "Particulars",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <DirectionIcon direction={row.original.direction} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="max-w-[320px] truncate font-medium">{row.original.particulars}</span>
                <SourceTag source={row.original.source} />
                <OriginTag origin={row.original.origin} />
              </div>
              {row.original.partyName && <div className="text-xs text-muted-foreground">{row.original.partyName}</div>}
            </div>
          </div>
        ),
      },
      { accessorKey: "category", header: "Category" },
      { accessorKey: "mode", header: "Mode", cell: ({ getValue }) => <ModeBadge mode={getValue() as PaymentMode} /> },
      {
        id: "ref",
        header: "Reference",
        accessorFn: (t) => t.reference ?? t.externalRef ?? "",
        cell: ({ getValue }) => <span className="text-[13px] text-muted-foreground">{(getValue() as string) || "—"}</span>,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className={cn("font-semibold", row.original.direction === "in" ? "text-success-foreground" : "text-foreground")}>
            {row.original.direction === "in" ? "+" : "−"}
            {formatINR(row.original.amount)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right", className: "w-12" },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem destructive disabled={row.original.source === "vyapar_import" || !!row.original.origin} onSelect={() => setToDelete(row.original)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  const setDirection = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("direction");
    else next.set("direction", v);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={`Cash In · ${periods[period]}`} icon={ArrowDownToLine} tone="success" loading={isLoading} value={formatINR(totals.inn)} />
        <StatCard label={`Cash Out · ${periods[period]}`} icon={ArrowUpRight} tone="danger" loading={isLoading} value={formatINR(totals.out)} />
        <StatCard label="Net Cash Flow" icon={Scale} tone="brand" loading={isLoading} value={formatINR(totals.net, { sign: true })}
          footnote="Includes advances, loans & capital items" />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        getRowId={(t) => t.id}
        initialSort={[{ id: "date", desc: true }]}
        searchPlaceholder="Search particulars, party, category…"
        toolbar={
          <>
            <Tabs value={direction} onValueChange={setDirection}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="in">Income</TabsTrigger>
                <TabsTrigger value="out">Expenses</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(periods).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode | "all")}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setShowVyaparImport(true)}>
              <FileInput /> Import Vyapar
            </Button>
            <Button variant="outline" onClick={() => filtered && exportTransactions(filtered)} disabled={!filtered?.length}>
              <Download /> Export
            </Button>
            <Hint label={`${modKeyLabel}⇧E`}>
              <Button onClick={() => openTxn(direction === "in" ? "in" : "out")}>
                <Plus /> Add transaction
              </Button>
            </Hint>
          </>
        }
        empty={{
          title: "No transactions in this period",
          description: "Change the period filter or record a new transaction.",
          action: <Button size="sm" onClick={() => openTxn("out")}><Plus /> Add transaction</Button>,
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete this transaction?"
        description={
          toDelete && (
            <>
              <span className="font-medium text-foreground">{toDelete.particulars}</span> — {formatINR(toDelete.amount)} on {formatDate(toDelete.date)}.
              {" "}This removes it from cash flow and reports. This can't be undone.
            </>
          )
        }
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await del.mutateAsync(toDelete.id);
            toast.success("Transaction deleted");
          } catch (e) {
            toast.error("Couldn't delete", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
      />

      <ImportVyaparDialog
        open={showVyaparImport}
        onOpenChange={setShowVyaparImport}
      />
    </div>
  );
}
