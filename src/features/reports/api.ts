/**
 * Report queries. Every report is computed server-side (Rust/MongoDB
 * aggregation) in production; these mocks compute the same shapes from the
 * in-memory seed so the screens can be reviewed.
 *
 * Accounting rules used throughout:
 *  - Cash flow counts every movement of money (all treatments).
 *  - Profit counts only operating items, and takes labour cost from payroll
 *    gross (accrual) instead of salary cash paid, so advances and timing of
 *    payouts don't distort it.
 */
import { useQuery } from "@tanstack/react-query";
import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import { command } from "@/lib/ipc";
import { attendance, productionEntries, productionOrders, transactions, workers } from "@/data/mock/seed";
import { payrollRunFor } from "@/features/payroll/api";
import { workingDays } from "@/features/workers/api";
import type { CashTreatment, Department, PaymentMode, ProductionStage, WastageReason } from "@/types/domain";
import type { ReportRange } from "./range";

const WAGES = "Wages & Salary";
const inRange = (d: string, r: ReportRange) => d >= r.from && d <= r.to;

/* ───────── Income vs expenses / profit ───────── */
export interface ProfitMonth {
  month: string;
  receipts: number;
  materials: number;
  labour: number;
  labourBasis: "payroll" | "cash";
  overheads: number;
  profit: number;
}
export interface CategoryRow { category: string; treatment: CashTreatment; direction: "in" | "out"; amount: number; count: number }
export interface ProfitReport {
  months: ProfitMonth[];
  categories: CategoryRow[];
  totals: { receipts: number; materials: number; labour: number; overheads: number; profit: number; operatingCash: number };
}

/** First day with attendance in BoxERP; earlier months have no reliable payroll. */
const trackingSince = () => attendance.reduce((m, a) => (a.date < m ? a.date : m), "9999-12-31");

function labourFor(month: string) {
  if (`${month}-01` >= trackingSince()) {
    const run = payrollRunFor(month);
    return { amount: run.lines.reduce((s, l) => s + l.gross, 0), basis: "payroll" as const };
  }
  // Before BoxERP payroll: salary for a month is paid early the following month.
  const next = format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM");
  const cash = transactions.filter((t) => t.category === WAGES && t.date.startsWith(next)).reduce((s, t) => s + t.amount, 0);
  return { amount: cash, basis: "cash" as const };
}

function profit(r: ReportRange): ProfitReport {
  const ops = transactions.filter((t) => inRange(t.date, r) && t.treatment === "operating" && !t.matchedTo);
  const months = r.months.map<ProfitMonth>((m) => {
    const mt = ops.filter((t) => t.date.startsWith(m));
    const receipts = mt.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    const materials = mt.filter((t) => t.direction === "out" && t.category === "Raw Material").reduce((s, t) => s + t.amount, 0);
    const overheads = mt.filter((t) => t.direction === "out" && t.category !== "Raw Material" && t.category !== WAGES).reduce((s, t) => s + t.amount, 0);
    const lab = labourFor(m);
    return { month: m, receipts, materials, labour: lab.amount, labourBasis: lab.basis, overheads, profit: receipts - materials - lab.amount - overheads };
  });
  const cat = new Map<string, CategoryRow>();
  for (const t of transactions.filter((x) => inRange(x.date, r) && !x.matchedTo)) {
    const key = `${t.direction}:${t.category}`;
    const c = cat.get(key) ?? { category: t.category, treatment: t.treatment, direction: t.direction, amount: 0, count: 0 };
    c.amount += t.amount;
    c.count++;
    cat.set(key, c);
  }
  const sum = (k: keyof ProfitMonth) => months.reduce((s, m) => s + (m[k] as number), 0);
  const opIn = ops.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const opOut = ops.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  return {
    months,
    categories: [...cat.values()].sort((a, b) => (a.direction === b.direction ? b.amount - a.amount : a.direction === "in" ? -1 : 1)),
    totals: { receipts: sum("receipts"), materials: sum("materials"), labour: sum("labour"), overheads: sum("overheads"), profit: sum("profit"), operatingCash: opIn - opOut },
  };
}

/* ───────── Cash flow ───────── */
export interface CashFlowReport {
  byTreatment: { treatment: CashTreatment; cashIn: number; cashOut: number; net: number }[];
  byMode: { mode: PaymentMode; cashIn: number; cashOut: number; net: number }[];
  months: { month: string; cashIn: number; cashOut: number; net: number; cumulative: number }[];
  totals: { cashIn: number; cashOut: number; net: number };
}

function cashFlow(r: ReportRange): CashFlowReport {
  const tx = transactions.filter((t) => inRange(t.date, r) && !t.matchedTo);
  const agg = <K extends string>(key: (t: (typeof tx)[number]) => K, keys: K[]) =>
    keys.map((k) => {
      const list = tx.filter((t) => key(t) === k);
      const cashIn = list.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
      const cashOut = list.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
      return { k, cashIn, cashOut, net: cashIn - cashOut };
    });
  let cum = 0;
  const months = r.months.map((m) => {
    const list = tx.filter((t) => t.date.startsWith(m));
    const cashIn = list.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    const cashOut = list.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
    cum += cashIn - cashOut;
    return { month: m, cashIn, cashOut, net: cashIn - cashOut, cumulative: cum };
  });
  const cashIn = tx.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const cashOut = tx.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  return {
    byTreatment: agg((t) => t.treatment, ["operating", "advance", "capital", "loan", "transfer"] as CashTreatment[]).map(({ k, ...v }) => ({ treatment: k, ...v })),
    byMode: agg((t) => t.mode, ["cash", "bank", "upi"] as PaymentMode[]).map(({ k, ...v }) => ({ mode: k, ...v })),
    months,
    totals: { cashIn, cashOut, net: cashIn - cashOut },
  };
}

/* ───────── Labour cost ───────── */
export interface LabourReport {
  months: { month: string; basic: number; overtime: number; bonus: number; gross: number; manDays: number; basis: "payroll" | "cash" }[];
  departments: { department: Department; workers: number; manDays: number; basic: number; overtime: number; bonus: number; gross: number }[];
  totals: { gross: number; overtime: number; manDays: number; receipts: number };
}

function labour(r: ReportRange): LabourReport {
  const dept = new Map<Department, LabourReport["departments"][number] & { ids: Set<string> }>();
  const months = r.months.map((m) => {
    const lab = labourFor(m);
    if (lab.basis === "cash") return { month: m, basic: lab.amount, overtime: 0, bonus: 0, gross: lab.amount, manDays: 0, basis: "cash" as const };
    const run = payrollRunFor(m);
    for (const l of run.lines) {
      const d = dept.get(l.department) ?? { department: l.department, workers: 0, manDays: 0, basic: 0, overtime: 0, bonus: 0, gross: 0, ids: new Set<string>() };
      d.ids.add(l.workerId);
      d.manDays += l.paidDays;
      d.basic += l.basic;
      d.overtime += l.overtime;
      d.bonus += l.bonus;
      d.gross += l.gross;
      dept.set(l.department, d);
    }
    const sum = (f: (l: (typeof run.lines)[number]) => number) => run.lines.reduce((s, l) => s + f(l), 0);
    return { month: m, basic: sum((l) => l.basic), overtime: sum((l) => l.overtime), bonus: sum((l) => l.bonus), gross: sum((l) => l.gross), manDays: sum((l) => l.paidDays), basis: "payroll" as const };
  });
  const receipts = transactions.filter((t) => inRange(t.date, r) && t.treatment === "operating" && t.direction === "in").reduce((s, t) => s + t.amount, 0);
  return {
    months,
    departments: [...dept.values()].map(({ ids, ...d }) => ({ ...d, workers: ids.size })).sort((a, b) => b.gross - a.gross),
    totals: { gross: months.reduce((s, m) => s + m.gross, 0), overtime: months.reduce((s, m) => s + m.overtime, 0), manDays: months.reduce((s, m) => s + m.manDays, 0), receipts },
  };
}

/* ───────── Attendance ───────── */
export interface AttendanceRow {
  workerId: string; code: string; name: string; department: Department; active: boolean;
  expected: number; present: number; halfDay: number; absent: number; leave: number; unmarked: number; overtimeHours: number; pct: number;
}
export interface AttendanceReport { workers: AttendanceRow[]; departments: { department: Department; workers: number; pct: number; absent: number; overtimeHours: number }[] }

function attendanceReport(r: ReportRange): AttendanceReport {
  const today = format(new Date(), "yyyy-MM-dd");
  const end = r.to < today ? r.to : today;
  const rows = workers
    .filter((w) => w.joinedOn <= end && (!w.leftOn || w.leftOn >= r.from))
    .map<AttendanceRow>((w) => {
      const recs = attendance.filter((a) => a.workerId === w.id && a.date >= r.from && a.date <= end);
      const from = w.joinedOn > r.from ? w.joinedOn : r.from;
      const to = w.leftOn && w.leftOn < end ? w.leftOn : end;
      const expected = workingDays(from, to);
      const c = (s: string) => recs.filter((x) => x.status === s).length;
      const present = c("present"), halfDay = c("half_day");
      return {
        workerId: w.id, code: w.code, name: w.name, department: w.department, active: w.active, expected,
        present, halfDay, absent: c("absent"), leave: c("leave"), unmarked: Math.max(0, expected - recs.length),
        overtimeHours: recs.reduce((s, x) => s + x.overtimeHours, 0),
        pct: expected ? ((present + halfDay * 0.5) / expected) * 100 : 0,
      };
    });
  const deps = new Map<Department, { department: Department; workers: number; expected: number; paid: number; absent: number; overtimeHours: number }>();
  for (const x of rows) {
    const d = deps.get(x.department) ?? { department: x.department, workers: 0, expected: 0, paid: 0, absent: 0, overtimeHours: 0 };
    d.workers++; d.expected += x.expected; d.paid += x.present + x.halfDay * 0.5; d.absent += x.absent; d.overtimeHours += x.overtimeHours;
    deps.set(x.department, d);
  }
  return {
    workers: rows,
    departments: [...deps.values()].map((d) => ({ department: d.department, workers: d.workers, pct: d.expected ? (d.paid / d.expected) * 100 : 0, absent: d.absent, overtimeHours: d.overtimeHours })),
  };
}

/* ───────── Payroll ───────── */
export interface PayrollReportRow { month: string; status: "draft" | "finalized"; inProgress: boolean; untracked: boolean; workers: number; gross: number; advance: number; other: number; net: number; paid: number; pending: number }

function payrollReport(r: ReportRange): PayrollReportRow[] {
  const current = format(new Date(), "yyyy-MM");
  return r.months.map((m) => {
    if (`${m}-01` < trackingSince())
      return { month: m, status: "draft" as const, inProgress: false, untracked: true, workers: 0, gross: 0, advance: 0, other: 0, net: 0, paid: 0, pending: 0 };
    const run = payrollRunFor(m);
    const s = (f: (l: (typeof run.lines)[number]) => number) => run.lines.reduce((a, l) => a + f(l), 0);
    const paid = run.lines.filter((l) => l.paymentId).reduce((a, l) => a + l.net, 0);
    const net = s((l) => l.net);
    return {
      month: m, status: run.status, inProgress: m === current, untracked: false, workers: run.lines.length,
      gross: s((l) => l.gross), advance: s((l) => l.advanceDeduction), other: s((l) => l.otherDeduction), net, paid,
      pending: run.status === "finalized" ? net - paid : 0,
    };
  });
}

/* ───────── Production ───────── */
export interface ProductionReport {
  totals: { good: number; wastage: number; ordersCompleted: number; onTime: number; activeOrders: number };
  byReason: { reason: WastageReason | "unspecified"; qty: number }[];
  byCustomer: { customer: string; orders: number; good: number; wastage: number }[];
  byStage: { stage: ProductionStage; good: number; wastage: number }[];
  completed: { orderNo: string; customer: string; product: string; plannedQty: number; producedQty: number; wastageQty: number; dueDate: string; completedOn: string; lateDays: number }[];
  daily: { date: string; good: number; wastage: number }[];
}

function production(r: ReportRange): ProductionReport {
  const entries = productionEntries.filter((e) => inRange(e.date, r));
  const orderById = new Map(productionOrders.map((o) => [o.id, o]));
  const reason = new Map<string, number>();
  const cust = new Map<string, { customer: string; orders: Set<string>; good: number; wastage: number }>();
  const stage = new Map<ProductionStage, { stage: ProductionStage; good: number; wastage: number }>();
  const daily = new Map<string, { date: string; good: number; wastage: number }>();
  for (const e of entries) {
    if (e.wastageQty) reason.set(e.wastageReason ?? "unspecified", (reason.get(e.wastageReason ?? "unspecified") ?? 0) + e.wastageQty);
    const o = orderById.get(e.orderId);
    if (o) {
      const c = cust.get(o.customer) ?? { customer: o.customer, orders: new Set(), good: 0, wastage: 0 };
      c.orders.add(o.id); c.good += e.goodQty; c.wastage += e.wastageQty;
      cust.set(o.customer, c);
    }
    const s = stage.get(e.stage) ?? { stage: e.stage, good: 0, wastage: 0 };
    s.good += e.goodQty; s.wastage += e.wastageQty; stage.set(e.stage, s);
    const d = daily.get(e.date) ?? { date: e.date, good: 0, wastage: 0 };
    d.good += e.goodQty; d.wastage += e.wastageQty; daily.set(e.date, d);
  }
  const completed = productionOrders
    .filter((o) => o.stage === "completed" && o.completedOn && inRange(o.completedOn, r))
    .map((o) => ({
      orderNo: o.orderNo, customer: o.customer, product: o.product, plannedQty: o.plannedQty, producedQty: o.producedQty, wastageQty: o.wastageQty,
      dueDate: o.dueDate, completedOn: o.completedOn!, lateDays: Math.max(0, differenceInCalendarDays(parseISO(o.completedOn!), parseISO(o.dueDate))),
    }));
  return {
    totals: {
      good: entries.reduce((s, e) => s + e.goodQty, 0),
      wastage: entries.reduce((s, e) => s + e.wastageQty, 0),
      ordersCompleted: completed.length,
      onTime: completed.filter((c) => c.lateDays === 0).length,
      activeOrders: productionOrders.filter((o) => o.stage !== "completed").length,
    },
    byReason: [...reason.entries()].map(([k, qty]) => ({ reason: k as WastageReason | "unspecified", qty })).sort((a, b) => b.qty - a.qty),
    byCustomer: [...cust.values()].map((c) => ({ customer: c.customer, orders: c.orders.size, good: c.good, wastage: c.wastage })).sort((a, b) => b.good - a.good),
    byStage: [...stage.values()],
    completed,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/* ───────── hooks ───────── */
const key = (name: string, r: ReportRange) => ["reports", name, r.from, r.to] as const;
const opts = { staleTime: 60_000, placeholderData: <T,>(p: T | undefined) => p };

export const useProfitReport = (r: ReportRange) => useQuery({ queryKey: key("profit", r), queryFn: () => command("report_profit", { from: r.from, to: r.to }, () => profit(r)), ...opts });
export const useCashFlowReport = (r: ReportRange) => useQuery({ queryKey: key("cash-flow", r), queryFn: () => command("report_cash_flow", { from: r.from, to: r.to }, () => cashFlow(r)), ...opts });
export const useLabourReport = (r: ReportRange) => useQuery({ queryKey: key("labour", r), queryFn: () => command("report_labour", { from: r.from, to: r.to }, () => labour(r)), ...opts });
export const useAttendanceReport = (r: ReportRange) => useQuery({ queryKey: key("attendance", r), queryFn: () => command("report_attendance", { from: r.from, to: r.to }, () => attendanceReport(r)), ...opts });
export const usePayrollReport = (r: ReportRange) => useQuery({ queryKey: key("payroll", r), queryFn: () => command("report_payroll", { from: r.from, to: r.to }, () => payrollReport(r)), ...opts });
export const useProductionReport = (r: ReportRange) => useQuery({ queryKey: key("production", r), queryFn: () => command("report_production", { from: r.from, to: r.to }, () => production(r)), ...opts });

