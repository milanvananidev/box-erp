import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, endOfMonth, parseISO } from "date-fns";
import { toast } from "sonner";
import { Banknote, CalendarRange, CheckCircle2, Clock, Download, FileText, HandCoins, History, Info, Lock, Printer, Receipt, RotateCcw, Users, Wallet } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DataTable, type DataColumn } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatINR, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayrollLine, SalaryPayment } from "@/types/domain";
import {
  currentPeriod, periodLabel, periodShort, runQuery, useFinalizePayroll, usePayrollRun, usePendingSalaries, useReopenPayroll, useSalaryPayments,
  type PaymentRow, type PendingLine,
} from "./api";
import { PeriodPicker } from "./components/PeriodPicker";
import { RegisterTable } from "./components/RegisterTable";
import { AdjustLineDialog } from "./components/AdjustLineDialog";
import { PayDialog } from "./components/PayDialog";
import { SlipPreviewDialog, type SlipJob } from "./components/SlipPreviewDialog";

type Tab = "register" | "pending" | "history";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : undefined);

export default function PayrollPage() {
  usePageMeta("Payroll", "Salary runs, payouts and slips");
  const [params, setParams] = useSearchParams();
  const period = params.get("period") ?? currentPeriod();
  const tab = (params.get("tab") as Tab | null) ?? "register";
  const patch = useCallback(
    (c: Record<string, string | null>) =>
      setParams((prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(c)) v === null ? n.delete(k) : n.set(k, v);
        return n;
      }, { replace: true }),
    [setParams],
  );

  const run = usePayrollRun(period);
  const pending = usePendingSalaries();
  const payments = useSalaryPayments();
  const finalize = useFinalizePayroll();
  const reopen = useReopenPayroll();
  const qc = useQueryClient();

  const [adjusting, setAdjusting] = useState<PayrollLine | null>(null);
  const [paying, setPaying] = useState<{ period: string; lines: PayrollLine[] } | null>(null);
  const [slips, setSlips] = useState<SlipJob | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  const r = run.data?.period === period ? run.data : undefined;
  const finalized = r?.status === "finalized";
  const inProgress = period === currentPeriod();
  const lines = r?.lines ?? [];
  const unpaid = lines.filter((l) => !l.paymentId && l.net > 0);
  const gaps = lines.filter((l) => l.unmarkedDays > 0);
  const k = {
    gross: lines.reduce((s, l) => s + l.gross, 0),
    adv: lines.reduce((s, l) => s + l.advanceDeduction, 0),
    other: lines.reduce((s, l) => s + l.otherDeduction, 0),
    net: lines.reduce((s, l) => s + l.net, 0),
    paidNet: lines.filter((l) => l.paymentId).reduce((s, l) => s + l.net, 0),
  };

  const paymentMap = useMemo(() => new Map((payments.data ?? []).map((p) => [p.id, p as SalaryPayment])), [payments.data]);

  const openSlips = useCallback(
    (ls: PayrollLine[], p = period, wd = r?.workingDays ?? 0) => setSlips({ period: p, workingDays: wd, lines: ls, payments: paymentMap }),
    [period, r?.workingDays, paymentMap],
  );
  const openPay = useCallback((ls: PayrollLine[]) => setPaying({ period, lines: ls }), [period]);

  /** Slip for any period (pending / history tabs) — loads that period's run first. */
  const slipFor = async (p: string, workerId: string) => {
    try {
      const other = await qc.fetchQuery(runQuery(p));
      const line = other.lines.find((l) => l.workerId === workerId);
      if (line) openSlips([line], p, other.workingDays);
    } catch (e) {
      toast.error("Couldn't load slip", { description: errMsg(e) });
    }
  };

  const exportRegister = () => {
    downloadCsv(
      `payroll-${period}`,
      ["Code", "Name", "Department", "Wage type", "Present", "Half days", "Absent", "Leave", "Paid days", "OT hours", "Pieces", "Basic", "Overtime", "Bonus", "Gross", "Advance recovery", "Other deduction", "Deduction note", "Net pay", "Status"],
      lines.map((l) => [l.code, l.name, l.department, l.wageType, l.presentDays, l.halfDays, l.absentDays, l.leaveDays, l.paidDays, l.overtimeHours, l.pieces,
        fromPaise(l.basic), fromPaise(l.overtime), fromPaise(l.bonus), fromPaise(l.gross), fromPaise(l.advanceDeduction), fromPaise(l.otherDeduction), l.otherDeductionNote, fromPaise(l.net),
        !finalized ? "Draft" : l.paymentId ? "Paid" : "Pending"]),
    );
    toast.success(`Exported payroll register for ${periodShort(period)}`);
  };

  // columns are memoised once; always call the latest slipFor
  const slipRef = useRef(slipFor);
  slipRef.current = slipFor;

  /* ── Pending & history tables ── */
  const pendingCols = useMemo<DataColumn<PendingLine>[]>(
    () => [
      { accessorKey: "period", header: "Month", cell: ({ getValue }) => <span className="font-medium">{periodShort(getValue() as string)}</span> },
      { accessorKey: "name", header: "Worker", cell: ({ row: { original: l } }) => <div><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.code} · {l.department}</div></div> },
      {
        id: "age",
        header: "Waiting",
        accessorFn: (l) => differenceInCalendarDays(new Date(), endOfMonth(parseISO(`${l.period}-01`))),
        cell: ({ getValue }) => { const d = getValue() as number; return <span className={cn(d > 10 && "font-medium text-danger-foreground")}>{d} days</span>; },
      },
      { accessorKey: "advanceDeduction", header: "Advance recovery", meta: { align: "right" }, cell: ({ getValue }) => formatINR(getValue() as number) },
      { accessorKey: "net", header: "Net pay", meta: { align: "right" }, cell: ({ getValue }) => <span className="font-semibold">{formatINR(getValue() as number)}</span> },
      {
        id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: "right" },
        cell: ({ row: { original: l } }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => slipRef.current(l.period, l.workerId)}><FileText /> Slip</Button>
            <Button variant="soft" size="sm" onClick={() => setPaying({ period: l.period, lines: [l] })}><Banknote /> Pay</Button>
          </div>
        ),
      },
    ],
    [],
  );

  const historyCols = useMemo<DataColumn<PaymentRow>[]>(
    () => [
      { accessorKey: "paidOn", header: "Paid on", cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: "period", header: "For month", cell: ({ getValue }) => periodShort(getValue() as string) },
      { accessorKey: "name", header: "Worker", cell: ({ row: { original: p } }) => <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.code} · {p.department}</div></div> },
      { accessorKey: "gross", header: "Gross", meta: { align: "right" }, cell: ({ getValue }) => formatINR(getValue() as number) },
      { accessorKey: "advanceDeduction", header: "Advance", meta: { align: "right" }, cell: ({ getValue }) => { const v = getValue() as number; return v ? `− ${formatINR(v)}` : <span className="text-muted-foreground">—</span>; } },
      { accessorKey: "net", header: "Net paid", meta: { align: "right" }, cell: ({ getValue }) => <span className="font-semibold">{formatINR(getValue() as number)}</span> },
      { accessorKey: "mode", header: "Mode", cell: ({ getValue }) => <Badge tone="outline">{(getValue() as string).toUpperCase()}</Badge> },
      {
        id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: "right" },
        cell: ({ row: { original: p } }) => <Button variant="ghost" size="sm" onClick={() => slipRef.current(p.period, p.workerId)}><FileText /> Slip</Button>,
      },
    ],
    [],
  );

  const pendingTotal = (pending.data ?? []).reduce((s, l) => s + l.net, 0);

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={tab} onValueChange={(v) => patch({ tab: v === "register" ? null : v })}>
        <TabsList className="h-10">
          <TabsTrigger value="register" className="h-8 px-4"><CalendarRange className="size-4" /> Monthly payroll</TabsTrigger>
          <TabsTrigger value="pending" className="h-8 px-4">
            <Clock className="size-4" /> Pending salaries
            {!!pending.data?.length && <span className="rounded-full bg-warning px-1.5 text-[11px] font-semibold text-white">{pending.data.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="history" className="h-8 px-4"><History className="size-4" /> Payment history</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "register" && (
        <>
          <PeriodPicker value={period} onChange={(p) => patch({ period: p === currentPeriod() ? null : p })} />

          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Workers" icon={Users} tone="violet" loading={!r} value={lines.length} footnote={r && `${r.workingDays} working days in ${periodShort(period)}`} />
            <StatCard label="Labour Cost (Gross)" icon={Receipt} tone="brand" loading={!r} value={formatINR(k.gross)} footnote="Basic + overtime + bonus" />
            <StatCard label="Deductions" icon={HandCoins} tone="danger" loading={!r} value={formatINR(k.adv + k.other)} footnote={`Advance ${formatINR(k.adv)} · other ${formatINR(k.other)}`} />
            <StatCard label="Net Payable" icon={Wallet} tone="success" loading={!r} value={formatINR(k.net)}
              footnote={finalized ? `${formatINR(k.paidNet)} paid · ${formatINR(k.net - k.paidNet)} pending` : inProgress ? "Estimate so far" : "Not finalised"} />
          </div>

          {r && (
            <StatusBanner
              tone={finalized ? (unpaid.length ? "warning" : "success") : inProgress ? "info" : "warning"}
              icon={finalized ? (unpaid.length ? Clock : CheckCircle2) : inProgress ? Info : Lock}
              title={
                finalized
                  ? unpaid.length ? `Finalised on ${r.finalizedOn ? formatDate(r.finalizedOn) : "—"}. ${unpaid.length} salar${unpaid.length > 1 ? "ies" : "y"} still to pay.` : `Finalised and fully paid.`
                  : inProgress ? `${periodLabel(period)} is in progress. These are live estimates from attendance.` : `${periodLabel(period)} is not finalised yet.`
              }
              detail={
                finalized
                  ? "Figures are locked. Attendance changes no longer affect this month."
                  : inProgress ? "Bonuses and deductions can be set now. Finalise after the month ends, then pay."
                  : gaps.length ? `${gaps.length} worker${gaps.length > 1 ? "s have" : " has"} days with no attendance marked. Check the warning icons before finalising.` : "Review the register, then finalise to lock it and start paying."
              }
              actions={
                finalized ? (
                  <>
                    {!lines.some((l) => l.paymentId) && <Button variant="outline" onClick={() => setConfirmReopen(true)}><RotateCcw /> Reopen</Button>}
                    {unpaid.length > 0 && <Button onClick={() => openPay(unpaid)}><Banknote /> Pay all pending ({unpaid.length})</Button>}
                  </>
                ) : (
                  !inProgress && <Button onClick={() => setConfirmFinalize(true)}><Lock /> Finalise payroll</Button>
                )
              }
            />
          )}

          <RegisterTable
            run={r}
            isLoading={run.isLoading || !r}
            error={run.error}
            onRetry={() => run.refetch()}
            onAdjust={setAdjusting}
            onPay={openPay}
            onSlip={(ls) => openSlips(ls)}
            actions={
              <>
                <Button variant="outline" disabled={!lines.length} onClick={exportRegister}><Download /> Export</Button>
                <Button variant="outline" disabled={!lines.length} onClick={() => openSlips(lines)}><Printer /> {finalized ? "Print all slips" : "Preview slips"}</Button>
              </>
            }
          />
        </>
      )}

      {tab === "pending" && (
        <DataTable
          columns={pendingCols}
          data={pending.data}
          isLoading={pending.isLoading}
          error={pending.error}
          onRetry={() => pending.refetch()}
          getRowId={(l) => `${l.period}-${l.workerId}`}
          initialSort={[{ id: "period", desc: false }]}
          searchPlaceholder="Search worker…"
          actions={<span className="text-sm text-muted-foreground tabular">Total pending <b className="text-foreground">{formatINR(pendingTotal)}</b></span>}
          empty={{ title: "No pending salaries", description: "Every finalised payroll has been paid." }}
        />
      )}

      {tab === "history" && (
        <DataTable
          columns={historyCols}
          data={payments.data}
          isLoading={payments.isLoading}
          error={payments.error}
          onRetry={() => payments.refetch()}
          getRowId={(p) => p.id}
          initialSort={[{ id: "paidOn", desc: true }]}
          searchPlaceholder="Search worker, month…"
          actions={
            <Button variant="outline" disabled={!payments.data?.length} onClick={() => {
              const list = payments.data ?? [];
              downloadCsv("salary-payments", ["Paid on", "Month", "Code", "Worker", "Gross", "Advance recovered", "Net paid", "Mode"],
                list.map((p) => [p.paidOn, p.period, p.code, p.name, fromPaise(p.gross), fromPaise(p.advanceDeduction), fromPaise(p.net), p.mode.toUpperCase()]));
              toast.success(`Exported ${list.length} payments`);
            }}><Download /> Export</Button>
          }
          empty={{ title: "No salary payments yet" }}
        />
      )}

      <AdjustLineDialog period={period} line={adjusting} onOpenChange={(v) => !v && setAdjusting(null)} />
      <PayDialog period={paying?.period ?? period} lines={paying?.lines ?? null} onOpenChange={(v) => !v && setPaying(null)} />
      <SlipPreviewDialog job={slips} onOpenChange={(v) => !v && setSlips(null)} />
      <ConfirmDialog
        open={confirmFinalize}
        onOpenChange={setConfirmFinalize}
        title={`Finalise ${periodLabel(period)} payroll?`}
        description={
          <>
            This locks {lines.length} salaries totalling <b className="text-foreground">{formatINR(k.net)}</b>. Later attendance edits won't change them.
            {gaps.length > 0 && <span className="mt-2 block font-medium text-warning-foreground">{gaps.length} worker(s) still have unmarked attendance days.</span>}
          </>
        }
        confirmLabel="Finalise"
        onConfirm={async () => {
          try { await finalize.mutateAsync(period); toast.success(`${periodLabel(period)} payroll finalised`); }
          catch (e) { toast.error("Couldn't finalise", { description: errMsg(e) }); throw e; }
        }}
      />
      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title={`Reopen ${periodLabel(period)} payroll?`}
        description="Salaries will be recalculated from current attendance. Bonuses and deductions you entered are kept."
        confirmLabel="Reopen"
        onConfirm={async () => {
          try { await reopen.mutateAsync(period); toast.success("Payroll reopened"); }
          catch (e) { toast.error("Couldn't reopen", { description: errMsg(e) }); throw e; }
        }}
      />
    </div>
  );
}

function StatusBanner({ tone, icon: Icon, title, detail, actions }: { tone: "info" | "warning" | "success"; icon: React.ComponentType<{ className?: string }>; title: string; detail: string; actions?: React.ReactNode }) {
  const cls = { info: "border-info/20 bg-info-soft text-info-foreground", warning: "border-warning/30 bg-warning-soft text-warning-foreground", success: "border-success/20 bg-success-soft text-success-foreground" }[tone];
  return (
    <div className={cn("flex items-center gap-4 rounded-xl border px-5 py-3.5", cls)}>
      <Icon className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[13px] text-[#475467]">{detail}</p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
