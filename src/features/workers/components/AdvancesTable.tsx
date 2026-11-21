import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HandCoins, Trash2 } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatINR } from "@/lib/format";
import type { SalaryAdvance } from "@/types/domain";
import { useAdvances, useDeleteAdvance, useWorkerRoster } from "../api";

type Row = SalaryAdvance & { workerName: string; workerCode: string; balance: number };

export function AdvancesTable({ onGive, onOpenWorker }: { onGive: () => void; onOpenWorker: (id: string) => void }) {
  const { data, isLoading, error, refetch } = useAdvances();
  const { data: roster } = useWorkerRoster();
  const del = useDeleteAdvance();
  const [filter, setFilter] = useState<"outstanding" | "all">("outstanding");
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const rows = useMemo<Row[] | undefined>(() => {
    if (!data || !roster) return undefined;
    const byId = new Map(roster.map((w) => [w.id, w]));
    return data
      .map((a) => ({ ...a, workerName: byId.get(a.workerId)?.name ?? "—", workerCode: byId.get(a.workerId)?.code ?? "", balance: a.amount - a.recovered }))
      .filter((a) => filter === "all" || a.balance > 0);
  }, [data, roster, filter]);

  const columns = useMemo<DataColumn<Row>[]>(
    () => [
      { accessorKey: "date", header: "Date", cell: ({ getValue }) => formatDate(getValue() as string) },
      {
        accessorKey: "workerName",
        header: "Worker",
        cell: ({ row: { original: a } }) => (
          <button className="text-left hover:underline" onClick={() => onOpenWorker(a.workerId)}>
            <div className="font-medium">{a.workerName}</div>
            <div className="text-xs text-muted-foreground">{a.workerCode}</div>
          </button>
        ),
      },
      { accessorKey: "note", header: "Note", cell: ({ getValue }) => <span className="text-[13px] text-muted-foreground">{(getValue() as string) || "—"}</span> },
      { accessorKey: "mode", header: "Mode", cell: ({ getValue }) => <Badge tone="outline">{(getValue() as string).toUpperCase()}</Badge> },
      { accessorKey: "amount", header: "Given", meta: { align: "right" }, cell: ({ getValue }) => <span className="font-medium">{formatINR(getValue() as number)}</span> },
      { accessorKey: "recovered", header: "Recovered", meta: { align: "right" }, cell: ({ getValue }) => formatINR(getValue() as number) },
      {
        accessorKey: "balance",
        header: "Balance",
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const b = getValue() as number;
          return b > 0 ? <span className="font-semibold text-warning-foreground">{formatINR(b)}</span> : <Badge tone="success">Settled</Badge>;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right", className: "w-12" },
        cell: ({ row: { original: a } }) => (
          <Hint label={a.recovered > 0 ? "Partly recovered in payroll, so it can't be deleted" : "Delete advance"}>
            <span>
              <Button variant="ghost" size="icon-sm" disabled={a.recovered > 0} aria-label="Delete advance" onClick={() => setToDelete(a)}><Trash2 /></Button>
            </span>
          </Hint>
        ),
      },
    ],
    [onOpenWorker],
  );

  const outstanding = (rows ?? []).reduce((s, r) => s + r.balance, 0);

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        getRowId={(a) => a.id}
        initialSort={[{ id: "date", desc: true }]}
        searchPlaceholder="Search worker or note…"
        toolbar={
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        actions={
          <>
            <span className="text-sm text-muted-foreground tabular">Outstanding <b className="text-foreground">{formatINR(outstanding)}</b></span>
            <Button onClick={onGive}><HandCoins /> Give advance</Button>
          </>
        }
        empty={{ title: filter === "outstanding" ? "No outstanding advances" : "No advances yet", description: "Advances are recovered automatically from salary in payroll." }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete this advance?"
        description={toDelete && <>{formatINR(toDelete.amount)} to <b className="text-foreground">{toDelete.workerName}</b> on {formatDate(toDelete.date)}. Its cash-book entry is removed as well. This can't be undone.</>}
        onConfirm={async () => {
          if (!toDelete) return;
          try { await del.mutateAsync(toDelete.id); toast.success("Advance deleted"); }
          catch (e) { toast.error("Couldn't delete", { description: e instanceof Error ? e.message : undefined }); throw e; }
        }}
      />
    </>
  );
}
