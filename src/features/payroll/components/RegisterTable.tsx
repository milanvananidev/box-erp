import { useMemo, useState } from "react";
import { AlertTriangle, Banknote, FileText, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatINR } from "@/lib/format";
import { initials } from "@/lib/utils";
import type { PayrollLine, PayrollRun } from "@/types/domain";

type Filter = "all" | "pending" | "paid";

export function RegisterTable({
  run, isLoading, error, onRetry, onAdjust, onPay, onSlip, actions,
}: {
  run: PayrollRun | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onAdjust: (l: PayrollLine) => void;
  onPay: (l: PayrollLine[]) => void;
  onSlip: (l: PayrollLine[]) => void;
  actions?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const finalized = run?.status === "finalized";
  const rows = useMemo(
    () => run?.lines.filter((l) => !finalized || filter === "all" || (filter === "paid" ? !!l.paymentId : !l.paymentId)),
    [run, filter, finalized],
  );

  const columns = useMemo<DataColumn<PayrollLine>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Worker",
        cell: ({ row: { original: l } }) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-[#475467]">{initials(l.name)}</span>
            <div>
              <div className="font-medium">{l.name}</div>
              <div className="text-xs text-muted-foreground">{l.code} · {l.department}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "paidDays",
        header: "Paid days",
        meta: { align: "right" },
        cell: ({ row: { original: l } }) => (
          <div className="flex items-center justify-end gap-1.5">
            {l.unmarkedDays > 0 && (
              <Hint label={`${l.unmarkedDays} working day${l.unmarkedDays > 1 ? "s" : ""} without attendance`}>
                <AlertTriangle className="size-3.5 text-warning" />
              </Hint>
            )}
            <div>
              <div>{l.paidDays} <span className="text-muted-foreground">/ {run?.workingDays}</span></div>
              <div className="text-xs text-muted-foreground">{l.wageType === "piece_rate" ? `${l.pieces.toLocaleString("en-IN")} pcs` : l.halfDays ? `${l.halfDays} half` : " "}</div>
            </div>
          </div>
        ),
      },
      { accessorKey: "overtimeHours", header: "OT", meta: { align: "right" }, cell: ({ getValue }) => <span>{getValue() as number} h</span> },
      {
        accessorKey: "gross",
        header: "Earnings",
        meta: { align: "right" },
        cell: ({ row: { original: l } }) => (
          <div>
            <div className="font-medium">{formatINR(l.gross)}</div>
            <div className="text-xs text-muted-foreground">{formatINR(l.basic)} + {formatINR(l.overtime)} OT{l.bonus ? ` + ${formatINR(l.bonus)}` : ""}</div>
          </div>
        ),
      },
      {
        id: "deductions",
        header: "Deductions",
        meta: { align: "right" },
        accessorFn: (l) => l.advanceDeduction + l.otherDeduction,
        cell: ({ row: { original: l } }) =>
          l.advanceDeduction + l.otherDeduction === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div>
              <div className="text-danger-foreground">− {formatINR(l.advanceDeduction + l.otherDeduction)}</div>
              <div className="text-xs text-muted-foreground">
                {[l.advanceDeduction && `adv ${formatINR(l.advanceDeduction)}`, l.otherDeduction && `${l.otherDeductionNote ?? "other"} ${formatINR(l.otherDeduction)}`].filter(Boolean).join(" · ")}
              </div>
            </div>
          ),
      },
      { accessorKey: "net", header: "Net pay", meta: { align: "right" }, cell: ({ getValue }) => <span className="text-[15px] font-semibold">{formatINR(getValue() as number)}</span> },
      {
        id: "status",
        header: "Status",
        accessorFn: (l) => (l.paymentId ? 1 : 0),
        cell: ({ row: { original: l } }) =>
          !finalized ? <Badge tone="neutral">Draft</Badge> : l.paymentId ? <Badge tone="success" dot>Paid</Badge> : <Badge tone="warning" dot>Pending</Badge>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right", className: "w-12" },
        cell: ({ row: { original: l } }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.name}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {!finalized && <DropdownMenuItem onSelect={() => onAdjust(l)}><SlidersHorizontal /> Adjust bonus / deductions</DropdownMenuItem>}
              {finalized && !l.paymentId && <DropdownMenuItem onSelect={() => onPay([l])}><Banknote /> Pay salary</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => onSlip([l])}><FileText /> {finalized ? "Salary slip" : "Preview slip"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [finalized, run?.workingDays, onAdjust, onPay, onSlip],
  );

  const totals = (list: PayrollLine[]) => ({
    gross: list.reduce((s, l) => s + l.gross, 0),
    ded: list.reduce((s, l) => s + l.advanceDeduction + l.otherDeduction, 0),
    net: list.reduce((s, l) => s + l.net, 0),
  });

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowId={(l) => l.workerId}
      onRowClick={(l) => (finalized ? onSlip([l]) : onAdjust(l))}
      pageSize={50}
      searchPlaceholder="Search worker, code, department…"
      toolbar={
        finalized && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
            </TabsList>
          </Tabs>
        )
      }
      actions={actions}
      empty={{ title: filter === "pending" ? "Everyone has been paid" : "No workers in this payroll" }}
      footer={(list) => {
        const t = totals(list);
        return (
          <div className="flex justify-end gap-8 border-t border-border bg-subtle px-5 py-3 text-sm tabular">
            <span className="text-muted-foreground">Total of {list.length}</span>
            <span>Earnings <b>{formatINR(t.gross)}</b></span>
            <span>Deductions <b className="text-danger-foreground">− {formatINR(t.ded)}</b></span>
            <span>Net pay <b className="text-base">{formatINR(t.net)}</b></span>
          </div>
        );
      }}
    />
  );
}
