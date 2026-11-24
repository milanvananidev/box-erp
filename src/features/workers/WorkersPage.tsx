import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck, Download, HandCoins, IdCard, Plus, UserCheck, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatINR, fromPaise } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import { useDashboardSummary } from "@/features/dashboard/api";
import { DEPARTMENTS, WAGE_TYPE_LABEL, WAGE_UNIT, useWorkerRoster, type WorkerRow } from "./api";
import { AttendanceBoard } from "./components/AttendanceBoard";
import { WorkerFormSheet } from "./components/WorkerFormSheet";
import { WorkerDetailSheet } from "./components/WorkerDetailSheet";
import { AdvanceDialog } from "./components/AdvanceDialog";
import { AdvancesTable } from "./components/AdvancesTable";

type Tab = "attendance" | "workers" | "advances";

export default function WorkersPage() {
  usePageMeta("Workers & HR", "Daily attendance, worker profiles and salary advances");
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "attendance";
  const openId = params.get("worker");
  const editId = params.get("edit");
  const creating = params.get("new") === "1";
  const [advanceFor, setAdvanceFor] = useState<string | null | undefined>(undefined); // undefined = closed, null = pick worker
  const [status, setStatus] = useState<"active" | "left" | "all">("active");
  const [dept, setDept] = useState("all");

  const roster = useWorkerRoster();
  const summary = useDashboardSummary();

  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) v === null ? next.delete(k) : next.set(k, v);
        return next;
      }, { replace: true });
    },
    [setParams],
  );
  useHotkeys({ n: () => tab === "workers" && patch({ new: "1" }) }, !openId && !editId && !creating);

  const rows = useMemo(
    () => roster.data?.filter((w) => (status === "all" || (status === "active" ? w.active : !w.active)) && (dept === "all" || w.department === dept)),
    [roster.data, status, dept],
  );

  const kpi = useMemo(() => {
    const active = roster.data?.filter((w) => w.active) ?? [];
    return {
      active: active.length,
      byType: { daily: active.filter((w) => w.wageType === "daily").length, monthly: active.filter((w) => w.wageType === "monthly").length, piece: active.filter((w) => w.wageType === "piece_rate").length },
      advances: active.reduce((s, w) => s + w.advanceBalance, 0),
      withAdvance: active.filter((w) => w.advanceBalance > 0).length,
    };
  }, [roster.data]);

  const columns = useMemo<DataColumn<WorkerRow>[]>(
    () => [
      { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-medium text-[#475467]">{getValue() as string}</span> },
      {
        accessorKey: "name",
        header: "Worker",
        cell: ({ row: { original: w } }) => (
          <div className="flex items-center gap-3">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", w.active ? "bg-brand-50 text-brand-700" : "bg-muted text-muted-foreground")}>{initials(w.name)}</span>
            <div>
              <div className="font-medium">{w.name}</div>
              <div className="text-xs text-muted-foreground">{w.phone ?? "No phone"}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row: { original: w } }) => (
          <div>
            <div>{w.department}</div>
            <div className="text-xs text-muted-foreground">{w.designation}</div>
          </div>
        ),
      },
      {
        id: "wage",
        header: "Wage",
        meta: { align: "right" },
        accessorFn: (w) => fromPaise(w.wageRate),
        cell: ({ row: { original: w } }) => (
          <div>
            <div className="font-medium">{formatINR(w.wageRate, { precise: w.wageType === "piece_rate" })}<span className="font-normal text-muted-foreground">{WAGE_UNIT[w.wageType]}</span></div>
            <div className="text-xs text-muted-foreground">{WAGE_TYPE_LABEL[w.wageType]}</div>
          </div>
        ),
      },
      {
        accessorKey: "advanceBalance",
        header: "Advance due",
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return v > 0 ? <span className="font-medium text-warning-foreground">{formatINR(v)}</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row: { original: w } }) => (w.active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral">Left</Badge>),
      },
    ],
    [],
  );

  const exportRoster = (list: WorkerRow[]) => {
    downloadCsv(
      "workers",
      ["Code", "Name", "Phone", "Department", "Designation", "Joined", "Wage type", "Rate (INR)", "OT rate/hr (INR)", "Advance due (INR)", "Status"],
      list.map((w) => [w.code, w.name, w.phone, w.department, w.designation, w.joinedOn, WAGE_TYPE_LABEL[w.wageType], fromPaise(w.wageRate), fromPaise(w.overtimeRatePerHour), fromPaise(w.advanceBalance), w.active ? "Active" : `Left ${w.leftOn ?? ""}`]),
    );
    toast.success(`Exported ${list.length} workers`);
  };

  const openWorker = roster.data?.find((w) => w.id === openId);
  const editWorker = roster.data?.find((w) => w.id === editId);
  const att = summary.data?.attendance;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Workers" icon={Users} tone="violet" loading={roster.isLoading} value={kpi.active}
          footnote={`${kpi.byType.daily} daily · ${kpi.byType.monthly} monthly · ${kpi.byType.piece} piece`} onClick={() => patch({ tab: "workers" })} />
        <StatCard label="Present Today" icon={UserCheck} tone="success" loading={!att} value={att && `${att.present + att.halfDay} / ${att.total}`}
          footnote={att && `${att.halfDay} half day · ${att.absent} absent · ${att.leave} leave`} onClick={() => patch({ tab: null })} />
        <StatCard label="Advances Due" icon={HandCoins} tone="brand" loading={roster.isLoading} value={formatINR(kpi.advances)}
          footnote={`${kpi.withAdvance} workers · recovered in payroll`} onClick={() => patch({ tab: "advances" })} />
        <StatCard label="Salary Accrued" icon={Wallet} tone="info" loading={!summary.data} value={summary.data && formatINR(summary.data.salaryPending.amount)}
          footnote={summary.data && `This month · due ${formatDate(summary.data.salaryPending.dueOn)}`} />
      </div>

      <Tabs value={tab} onValueChange={(v) => patch({ tab: v === "attendance" ? null : v })}>
        <TabsList className="h-10">
          <TabsTrigger value="attendance" className="h-8 px-4"><CalendarCheck className="size-4" /> Daily attendance</TabsTrigger>
          <TabsTrigger value="workers" className="h-8 px-4"><IdCard className="size-4" /> Workers</TabsTrigger>
          <TabsTrigger value="advances" className="h-8 px-4"><HandCoins className="size-4" /> Advances</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "attendance" && <AttendanceBoard />}

      {tab === "workers" && (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={roster.isLoading}
          error={roster.error}
          onRetry={() => roster.refetch()}
          getRowId={(w) => w.id}
          onRowClick={(w) => patch({ worker: w.id })}
          initialSort={[{ id: "code", desc: false }]}
          pageSize={50}
          searchPlaceholder="Search name, code, phone…"
          toolbar={
            <>
              <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <TabsList>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="left">Left</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          }
          actions={
            <>
              <Button variant="outline" disabled={!rows?.length} onClick={() => rows && exportRoster(rows)}><Download /> Export</Button>
              <Hint label="Press N"><Button onClick={() => patch({ new: "1" })}><Plus /> Add worker</Button></Hint>
            </>
          }
          empty={{ title: status === "left" ? "No former workers" : "No workers yet", action: <Button size="sm" onClick={() => patch({ new: "1" })}><Plus /> Add worker</Button> }}
        />
      )}

      {tab === "advances" && <AdvancesTable onGive={() => setAdvanceFor(null)} onOpenWorker={(id) => patch({ worker: id })} />}

      <WorkerDetailSheet
        worker={openWorker}
        onClose={() => patch({ worker: null })}
        onEdit={(w) => patch({ worker: null, edit: w.id })}
        onGiveAdvance={(w) => setAdvanceFor(w.id)}
      />
      <WorkerFormSheet
        open={creating || !!editWorker}
        worker={editWorker}
        onClose={() => patch({ new: null, edit: null })}
        onSaved={(w) => patch({ new: null, edit: null, worker: w.id })}
      />
      <AdvanceDialog open={advanceFor !== undefined} onOpenChange={(v) => !v && setAdvanceFor(undefined)} workerId={advanceFor ?? undefined} />
    </div>
  );
}
