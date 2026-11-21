import {
  addDays, eachMonthOfInterval, endOfMonth, format, getDate, isSunday, startOfMonth, subDays, subMonths,
  eachDayOfInterval,
} from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { command } from "@/lib/ipc";
import { pendingFromFinalized } from "@/features/payroll/api";
import { calculateWage } from "@/lib/payroll";
import {
  TODAY, advanceBalance, attendance, monthProduction, productionOrders, transactions, workers, todayISO,
} from "@/data/mock/seed";
import type { CashFlowPoint, DashboardSummary, PendingSalary, ProductionOrder, Transaction } from "@/types/domain";

export type CashFlowRange = "30d" | "6m";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const pct = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / prev) * 100);
const sumWhere = (from: string, to: string, pred: (t: Transaction) => boolean) =>
  transactions.filter((t) => t.date >= from && t.date <= to && pred(t)).reduce((s, t) => s + t.amount, 0);


function pendingSalaries(): PendingSalary[] {
  const from = iso(startOfMonth(TODAY));
  const wd = eachDayOfInterval({ start: startOfMonth(TODAY), end: endOfMonth(TODAY) }).filter((d) => !isSunday(d)).length;
  return workers
    .filter((w) => w.active)
    .map((w) => {
      const recs = attendance.filter((a) => a.workerId === w.id && a.date >= from);
      const b = calculateWage(w, recs, { workingDays: wd, advanceOutstanding: advanceBalance(w.id) });
      return { workerId: w.id, name: w.name, department: w.department, netPayable: b.net, advance: b.advanceDeduction };
    })
    .sort((a, b) => b.netPayable - a.netPayable)
    .map(({ advance: _a, ...rest }) => rest);
}

function mockSummary(): DashboardSummary {
  const monthStart = iso(startOfMonth(TODAY));
  const prevStart = iso(startOfMonth(subMonths(TODAY, 1)));
  // month-to-date vs same number of days last month
  const prevEnd = iso(addDays(startOfMonth(subMonths(TODAY, 1)), getDate(TODAY) - 1));
  const operating = (t: Transaction) => t.treatment === "operating";

  const cashIn = sumWhere(monthStart, todayISO, (t) => t.direction === "in");
  const cashInPrev = sumWhere(prevStart, prevEnd, (t) => t.direction === "in");
  const cashOut = sumWhere(monthStart, todayISO, (t) => t.direction === "out");
  const cashOutPrev = sumWhere(prevStart, prevEnd, (t) => t.direction === "out");
  const opProfit = (from: string, to: string) =>
    sumWhere(from, to, (t) => operating(t) && t.direction === "in") - sumWhere(from, to, (t) => operating(t) && t.direction === "out");

  const today = attendance.filter((a) => a.date === todayISO);
  const pend = pendingSalaries();

  return {
    asOf: todayISO,
    cashIn: { value: cashIn, changePct: pct(cashIn, cashInPrev) },
    cashOut: { value: cashOut, changePct: pct(cashOut, cashOutPrev) },
    operatingProfit: { value: opProfit(monthStart, todayISO), changePct: null },
    productionToday: { value: monthProduction.today, changePct: pct(monthProduction.today, monthProduction.yesterday) },
    attendance: {
      present: today.filter((a) => a.status === "present").length,
      halfDay: today.filter((a) => a.status === "half_day").length,
      absent: today.filter((a) => a.status === "absent").length,
      leave: today.filter((a) => a.status === "leave").length,
      total: workers.filter((w) => w.active).length,
    },
    salaryPending: {
      amount: pend.reduce((s, p) => s + p.netPayable, 0),
      workers: pend.filter((p) => p.netPayable > 0).length,
      advancesOutstanding: workers.reduce((s, w) => s + advanceBalance(w.id), 0),
      unpaid: (() => { const p = pendingFromFinalized(); return { amount: p.reduce((s, l) => s + l.net, 0), workers: p.length }; })(),
      dueOn: iso(addDays(startOfMonth(addDays(endOfMonth(TODAY), 1)), 6)),
    },
    production: { planned: monthProduction.planned, produced: monthProduction.produced, wastage: monthProduction.wastage },
  };
}

function mockCashFlow(range: CashFlowRange): CashFlowPoint[] {
  if (range === "30d") {
    // 5 weekly buckets ending today
    return Array.from({ length: 5 }, (_, i) => {
      const end = subDays(TODAY, (4 - i) * 7);
      const start = subDays(end, 6);
      const [s, e] = [iso(start), iso(end)];
      return {
        label: format(start, "d MMM"),
        start: s,
        cashIn: sumWhere(s, e, (t) => t.direction === "in"),
        cashOut: sumWhere(s, e, (t) => t.direction === "out"),
      };
    });
  }
  return eachMonthOfInterval({ start: subMonths(TODAY, 5), end: TODAY }).map((m) => {
    const [s, e] = [iso(startOfMonth(m)), iso(endOfMonth(m))];
    return {
      label: format(m, "MMM"),
      start: s,
      cashIn: sumWhere(s, e, (t) => t.direction === "in"),
      cashOut: sumWhere(s, e, (t) => t.direction === "out"),
    };
  });
}

/* ── Query hooks ── */
export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
  cashFlow: (r: CashFlowRange) => [...dashboardKeys.all, "cash-flow", r] as const,
  recentTxns: () => [...dashboardKeys.all, "recent-transactions"] as const,
  activeOrders: () => [...dashboardKeys.all, "active-orders"] as const,
  pendingSalaries: () => [...dashboardKeys.all, "pending-salaries"] as const,
};

export const useDashboardSummary = () =>
  useQuery({ queryKey: dashboardKeys.summary(), queryFn: () => command("dashboard_summary", undefined, mockSummary) });

export const useCashFlow = (range: CashFlowRange) =>
  useQuery({
    queryKey: dashboardKeys.cashFlow(range),
    queryFn: () => command("dashboard_cash_flow", { range }, () => mockCashFlow(range)),
    placeholderData: (prev) => prev,
  });

export const useRecentTransactions = () =>
  useQuery({
    queryKey: dashboardKeys.recentTxns(),
    queryFn: () => command("transactions_recent", { limit: 5 }, () => transactions.filter((t) => !t.matchedTo).slice(0, 5)),
  });

export const useActiveOrders = () =>
  useQuery({
    queryKey: dashboardKeys.activeOrders(),
    queryFn: () =>
      command<ProductionOrder[]>("production_active_orders", undefined, () =>
        productionOrders.filter((o) => o.stage !== "completed").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      ),
  });

export const usePendingSalaries = () =>
  useQuery({ queryKey: dashboardKeys.pendingSalaries(), queryFn: () => command("payroll_pending", undefined, pendingSalaries) });

