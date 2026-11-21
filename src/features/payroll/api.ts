import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eachDayOfInterval, endOfMonth, format, isSunday, parseISO, startOfMonth, subMonths } from "date-fns";
import { command } from "@/lib/ipc";
import { buildPayrollLine } from "@/lib/payroll";
import { advances, attendance, payrollRuns, salaryPayments, transactions, workers } from "@/data/mock/seed";
import type { PaymentMode, PayrollAdjustment, PayrollLine, PayrollRun, SalaryPayment } from "@/types/domain";

export interface PeriodSummary {
  period: string;
  status: PayrollRun["status"];
  inProgress: boolean;
  workers: number;
  gross: number;
  net: number;
  paidCount: number;
  paidNet: number;
}

export interface PendingLine extends PayrollLine {
  period: string;
}

export interface PaymentRow extends SalaryPayment {
  name: string;
  code: string;
  department: string;
}

export interface PayInput {
  period: string;
  workerIds: string[];
  mode: PaymentMode;
  paidOn: string;
}

const fail = (kind: string, message: string) => ({ kind, message });
const iso = (d: Date) => format(d, "yyyy-MM-dd");
export const currentPeriod = () => format(new Date(), "yyyy-MM");
export const periodLabel = (p: string) => format(parseISO(`${p}-01`), "MMMM yyyy");
export const periodShort = (p: string) => format(parseISO(`${p}-01`), "MMM yyyy");

const nonSundays = (from: string, to: string) =>
  to < from ? 0 : eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).filter((d) => !isSunday(d)).length;

/* ── mock state ── */
const draftAdjustments = new Map<string, Map<string, PayrollAdjustment>>();

function computeDraft(period: string): PayrollRun {
  const month = parseISO(`${period}-01`);
  const from = iso(startOfMonth(month));
  const to = iso(endOfMonth(month));
  const today = iso(new Date());
  const until = to < today ? to : today;
  const adj = draftAdjustments.get(period);
  const lines = workers
    .filter((w) => w.joinedOn <= to && (!w.leftOn || w.leftOn >= from) && (w.active || w.leftOn))
    .map((w) => {
      const recs = attendance.filter((a) => a.workerId === w.id && a.date >= from && a.date <= to);
      const start = w.joinedOn > from ? w.joinedOn : from;
      const end = w.leftOn && w.leftOn < until ? w.leftOn : until;
      return buildPayrollLine(w, recs, {
        workingDays: nonSundays(from, to),
        expectedDays: nonSundays(start, end),
        // only advances given by the end of this period can be recovered from it
        advanceOutstanding: advances.filter((a) => a.workerId === w.id && a.date <= to).reduce((s, a) => s + a.amount - a.recovered, 0),
        adjustment: adj?.get(w.id),
      });
    })
    .filter((l) => l.paidDays > 0 || l.pieces > 0 || l.advanceOutstanding > 0 || l.unmarkedDays > 0);
  return { id: `draft-${period}`, period, status: "draft", workingDays: nonSundays(from, to), lines };
}

const findRun = (period: string) => payrollRuns.find((r) => r.period === period);

const mock = {
  periods(): PeriodSummary[] {
    return Array.from({ length: 4 }, (_, i) => format(subMonths(new Date(), i), "yyyy-MM")).map((p) => {
      const run = findRun(p) ?? computeDraft(p);
      const paid = run.lines.filter((l) => l.paymentId);
      return {
        period: p,
        status: run.status,
        inProgress: p === currentPeriod(),
        workers: run.lines.length,
        gross: run.lines.reduce((s, l) => s + l.gross, 0),
        net: run.lines.reduce((s, l) => s + l.net, 0),
        paidCount: paid.length,
        paidNet: paid.reduce((s, l) => s + l.net, 0),
      };
    });
  },

  run(period: string): PayrollRun {
    return findRun(period) ?? computeDraft(period);
  },

  adjust(period: string, workerId: string, a: PayrollAdjustment) {
    if (findRun(period)) throw fail("Conflict", "This payroll is finalised. Reopen it to make changes.");
    if (a.bonus < 0 || a.otherDeduction < 0 || (a.advanceDeduction ?? 0) < 0) throw fail("Validation", "Amounts can't be negative.");
    const map = draftAdjustments.get(period) ?? new Map();
    map.set(workerId, a);
    draftAdjustments.set(period, map);
    const line = computeDraft(period).lines.find((l) => l.workerId === workerId);
    if (line && line.net < 0) {
      map.delete(workerId);
      throw fail("Validation", "Deductions are more than the gross pay. Net pay can't be negative.");
    }
    return line;
  },

  finalize(period: string): PayrollRun {
    if (period >= currentPeriod()) throw fail("Validation", "A month can only be finalised after it ends. Attendance may still change.");
    if (findRun(period)) throw fail("Conflict", "This payroll is already finalised.");
    const draft = computeDraft(period);
    const run: PayrollRun = { ...draft, id: `run-${period}`, status: "finalized", finalizedOn: iso(new Date()) };
    payrollRuns.push(run);
    draftAdjustments.delete(period);
    return run;
  },

  reopen(period: string) {
    const i = payrollRuns.findIndex((r) => r.period === period);
    if (i === -1) throw fail("NotFound", "Payroll run not found.");
    if (payrollRuns[i]!.lines.some((l) => l.paymentId))
      throw fail("Conflict", "Salaries have already been paid from this run, so it can't be reopened. Make corrections in next month's payroll instead.");
    const run = payrollRuns.splice(i, 1)[0]!;
    // keep manual adjustments when reopening
    draftAdjustments.set(period, new Map(run.lines.map((l) => [l.workerId, { bonus: l.bonus, otherDeduction: l.otherDeduction, otherDeductionNote: l.otherDeductionNote, advanceDeduction: l.advanceDeduction }])));
    return period;
  },

  pay(input: PayInput) {
    const run = findRun(input.period);
    if (!run) throw fail("Conflict", "Finalise the payroll before paying salaries.");
    if (input.paidOn > iso(new Date())) throw fail("Validation", "Payment date can't be in the future.");
    const lines = run.lines.filter((l) => input.workerIds.includes(l.workerId) && !l.paymentId && l.net >= 0);
    if (!lines.length) throw fail("Validation", "Nothing left to pay for the selected workers.");
    const txnId = `t-sal-${input.period}-${input.mode}-${Date.now()}`;
    let total = 0;
    for (const l of lines) {
      const pay: SalaryPayment = {
        id: `sp-${l.workerId}-${input.period}`, workerId: l.workerId, period: input.period, paidOn: input.paidOn,
        gross: l.gross, advanceDeduction: l.advanceDeduction, net: l.net, mode: input.mode, transactionId: txnId,
      };
      salaryPayments.push(pay);
      l.paymentId = pay.id;
      total += l.net;
      // recover advances oldest-first
      let left = l.advanceDeduction;
      for (const a of advances.filter((x) => x.workerId === l.workerId && x.amount > x.recovered).sort((x, y) => x.date.localeCompare(y.date))) {
        if (left <= 0) break;
        const take = Math.min(left, a.amount - a.recovered);
        a.recovered += take;
        left -= take;
      }
    }
    // one cash-book entry per payout batch; wages are an operating expense
    transactions.unshift({
      id: txnId, date: input.paidOn, direction: "out", amount: total, category: "Wages & Salary", treatment: "operating", mode: input.mode,
      particulars: `Salary ${periodShort(input.period)} – ${lines.length} worker${lines.length > 1 ? "s" : ""}`, source: "manual", createdAt: new Date().toISOString(),
      origin: { module: "payroll", refId: input.period },
    });
    transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return { paid: lines.length, total };
  },

  pending(): PendingLine[] {
    return payrollRuns.flatMap((r) => r.lines.filter((l) => !l.paymentId && l.net > 0).map((l) => ({ ...l, period: r.period })));
  },

  payments(): PaymentRow[] {
    const byId = new Map(workers.map((w) => [w.id, w]));
    return salaryPayments
      .map((p) => ({ ...p, name: byId.get(p.workerId)?.name ?? "—", code: byId.get(p.workerId)?.code ?? "", department: byId.get(p.workerId)?.department ?? "" }))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || a.code.localeCompare(b.code));
  },
};

/* ── hooks ── */
export const payrollKeys = {
  all: ["payroll"] as const,
  periods: () => [...payrollKeys.all, "periods"] as const,
  run: (p: string) => [...payrollKeys.all, "run", p] as const,
  pending: () => [...payrollKeys.all, "pending"] as const,
  payments: () => [...payrollKeys.all, "payments"] as const,
};

export const usePayrollPeriods = () => useQuery({ queryKey: payrollKeys.periods(), queryFn: () => command("payroll_periods", undefined, mock.periods) });
export const runQuery = (period: string) => ({
  queryKey: payrollKeys.run(period),
  queryFn: () => command("payroll_run_get", { period }, () => mock.run(period)),
});
export const usePayrollRun = (period: string) => useQuery({ ...runQuery(period), placeholderData: (p) => p });
export const usePendingSalaries = () => useQuery({ queryKey: payrollKeys.pending(), queryFn: () => command("payroll_pending_lines", undefined, mock.pending) });
export const useSalaryPayments = () => useQuery({ queryKey: payrollKeys.payments(), queryFn: () => command("payroll_payments", undefined, mock.payments) });

function usePayrollMutation<A, R>(name: string, fn: (a: A) => R, args: (a: A) => Record<string, unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: A) => command<R>(name, args(a), () => fn(a)),
    onSuccess: () =>
      Promise.all(["payroll", "workers", "transactions", "dashboard"].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}

export const useAdjustLine = () =>
  usePayrollMutation("payroll_adjust_line", (a: { period: string; workerId: string; adjustment: PayrollAdjustment }) => mock.adjust(a.period, a.workerId, a.adjustment), (a) => a);
export const useFinalizePayroll = () => usePayrollMutation("payroll_finalize", (period: string) => mock.finalize(period), (period) => ({ period }));
export const useReopenPayroll = () => usePayrollMutation("payroll_reopen", (period: string) => mock.reopen(period), (period) => ({ period }));
export const usePaySalaries = () => usePayrollMutation("payroll_pay", mock.pay, (input) => ({ input }));

/** For the dashboard: unpaid salaries from finalised runs. */
export const pendingFromFinalized = () => mock.pending();

/** For other modules' mock reports: the run (finalised or live draft) for a period. */
export const payrollRunFor = (period: string) => mock.run(period);
