import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eachDayOfInterval, endOfMonth, format, isSunday, parseISO, startOfMonth } from "date-fns";
import { command } from "@/lib/ipc";
import { advanceBalance, advances, attendance, salaryPayments, transactions, workers } from "@/data/mock/seed";
import type {
  AttendanceRecord, AttendanceStatus, Department, PaymentMode, SalaryAdvance, SalaryPayment, WageType, Worker,
} from "@/types/domain";

/* ── DTOs ── */
export interface WorkerRow extends Worker {
  advanceBalance: number;
  /** Attendance % for the current month to date (present + ½ half-days over working days) */
  monthAttendancePct: number | null;
}

export interface WorkerInput {
  name: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  department: Department;
  designation: string;
  joinedOn: string;
  wageType: WageType;
  wageRate: number; // paise
  overtimeRatePerHour: number; // paise
  notes?: string;
}

export interface AttendanceMark {
  workerId: string;
  status: AttendanceStatus;
  overtimeHours: number;
  pieces?: number;
}

export interface AdvanceInput {
  workerId: string;
  date: string;
  amount: number; // paise
  mode: PaymentMode;
  note?: string;
}

export type HistoryItem =
  | { kind: "salary"; date: string; item: SalaryPayment }
  | { kind: "advance"; date: string; item: SalaryAdvance };

const fail = (kind: string, message: string) => ({ kind, message });
const todayISO = () => format(new Date(), "yyyy-MM-dd");

/** Working days (Mon–Sat) in [from, to] */
export function workingDays(from: string, to: string) {
  if (to < from) return 0;
  return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).filter((d) => !isSunday(d)).length;
}

/* ── mock implementation (Rust commands will enforce the same rules) ── */
const mock = {
  roster(): WorkerRow[] {
    const from = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const to = todayISO();
    return workers.map((w) => {
      const recs = attendance.filter((a) => a.workerId === w.id && a.date >= from && a.date <= to);
      const days = workingDays(from > w.joinedOn ? from : w.joinedOn, to);
      const paid = recs.reduce((s, r) => s + (r.status === "present" ? 1 : r.status === "half_day" ? 0.5 : 0), 0);
      return { ...w, advanceBalance: advanceBalance(w.id), monthAttendancePct: w.active && days > 0 ? (paid / days) * 100 : null };
    });
  },

  createWorker(input: WorkerInput): Worker {
    const max = Math.max(...workers.map((w) => Number(w.code.replace(/\D/g, "")) || 0), 100);
    const w: Worker = { ...input, id: `w${Date.now()}`, code: `EMP-${String(max + 1).padStart(4, "0")}`, active: true };
    workers.push(w);
    return w;
  },

  updateWorker(id: string, input: WorkerInput): Worker {
    const w = workers.find((x) => x.id === id);
    if (!w) throw fail("NotFound", "Worker not found.");
    Object.assign(w, input);
    return w;
  },

  setActive(id: string, active: boolean, leftOn?: string): Worker {
    const w = workers.find((x) => x.id === id);
    if (!w) throw fail("NotFound", "Worker not found.");
    if (!active && advanceBalance(id) > 0)
      throw fail("Conflict", "This worker still has an unrecovered advance. Settle it in the final salary before marking them as left.");
    w.active = active;
    w.leftOn = active ? undefined : (leftOn ?? todayISO());
    return w;
  },

  day(date: string): AttendanceRecord[] {
    return attendance.filter((a) => a.date === date);
  },

  saveDay(date: string, marks: AttendanceMark[]) {
    if (date > todayISO()) throw fail("Validation", "Attendance can't be marked for a future date.");
    for (const m of marks) {
      if (m.overtimeHours < 0 || m.overtimeHours > 12) throw fail("Validation", "Overtime must be between 0 and 12 hours.");
      if ((m.status === "absent" || m.status === "leave") && (m.overtimeHours > 0 || (m.pieces ?? 0) > 0))
        throw fail("Validation", "Absent or on-leave workers can't have overtime or pieces.");
      const existing = attendance.find((a) => a.date === date && a.workerId === m.workerId);
      if (existing) Object.assign(existing, m);
      else attendance.push({ ...m, id: `a-${date}-${m.workerId}`, date });
    }
    return { saved: marks.length };
  },

  month(workerId: string, month: string): AttendanceRecord[] {
    return attendance.filter((a) => a.workerId === workerId && a.date.startsWith(month));
  },

  advances(): SalaryAdvance[] {
    return [...advances].sort((a, b) => b.date.localeCompare(a.date));
  },

  giveAdvance(input: AdvanceInput): SalaryAdvance {
    const w = workers.find((x) => x.id === input.workerId);
    if (!w?.active) throw fail("Validation", "Advances can only be given to active workers.");
    if (input.date > todayISO()) throw fail("Validation", "Advance date can't be in the future.");
    const id = `adv${Date.now()}`;
    const a: SalaryAdvance = { ...input, id, recovered: 0, transactionId: `t-${id}` };
    advances.push(a);
    // Single cash-book entry; treatment "advance" keeps it out of expenses/profit.
    transactions.unshift({
      id: a.transactionId, date: a.date, direction: "out", amount: a.amount, category: "Salary Advance", treatment: "advance",
      mode: a.mode, particulars: `Advance – ${w.name}`, reference: a.note, source: "manual", createdAt: new Date().toISOString(),
      origin: { module: "advance", refId: a.id },
    });
    transactions.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
    return a;
  },

  deleteAdvance(id: string) {
    const i = advances.findIndex((a) => a.id === id);
    if (i === -1) throw fail("NotFound", "Advance not found.");
    if (advances[i]!.recovered > 0) throw fail("Conflict", "Part of this advance has already been recovered in payroll, so it can't be deleted.");
    const [a] = advances.splice(i, 1);
    const t = transactions.findIndex((x) => x.id === a!.transactionId);
    if (t !== -1) transactions.splice(t, 1);
    return id;
  },

  history(workerId: string): HistoryItem[] {
    return [
      ...salaryPayments.filter((p) => p.workerId === workerId).map<HistoryItem>((p) => ({ kind: "salary", date: p.paidOn, item: p })),
      ...advances.filter((a) => a.workerId === workerId).map<HistoryItem>((a) => ({ kind: "advance", date: a.date, item: a })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  },
};

/* ── hooks ── */
export const workerKeys = {
  all: ["workers"] as const,
  roster: () => [...workerKeys.all, "roster"] as const,
  day: (date: string) => [...workerKeys.all, "attendance-day", date] as const,
  month: (id: string, m: string) => [...workerKeys.all, "attendance-month", id, m] as const,
  advances: () => [...workerKeys.all, "advances"] as const,
  history: (id: string) => [...workerKeys.all, "history", id] as const,
};

export const useWorkerRoster = () =>
  useQuery({ queryKey: workerKeys.roster(), queryFn: () => command("workers_roster", undefined, mock.roster) });

export const useAttendanceDay = (date: string) =>
  useQuery({ queryKey: workerKeys.day(date), queryFn: () => command("attendance_for_day", { date }, () => mock.day(date)) });

export const useWorkerMonth = (workerId: string | undefined, month: string) =>
  useQuery({
    queryKey: workerKeys.month(workerId ?? "", month),
    enabled: !!workerId,
    queryFn: () => command("attendance_for_worker_month", { workerId, month }, () => mock.month(workerId!, month)),
  });

export const useAdvances = () =>
  useQuery({ queryKey: workerKeys.advances(), queryFn: () => command("advances_list", undefined, mock.advances) });

export const useWorkerHistory = (workerId: string | undefined) =>
  useQuery({
    queryKey: workerKeys.history(workerId ?? ""),
    enabled: !!workerId,
    queryFn: () => command("worker_payment_history", { workerId }, () => mock.history(workerId!)),
  });

function useWorkersMutation<A, R>(name: string, fn: (a: A) => R, args: (a: A) => Record<string, unknown>, extraKeys: readonly unknown[][] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: A) => command<R>(name, args(a), () => fn(a)),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: workerKeys.all }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        ...extraKeys.map((k) => qc.invalidateQueries({ queryKey: k })),
      ]),
  });
}

export const useCreateWorker = () => useWorkersMutation("worker_create", mock.createWorker, (input) => ({ input }));
export const useUpdateWorker = () =>
  useWorkersMutation("worker_update", (a: { id: string; input: WorkerInput }) => mock.updateWorker(a.id, a.input), (a) => a);
export const useSetWorkerActive = () =>
  useWorkersMutation("worker_set_active", (a: { id: string; active: boolean; leftOn?: string }) => mock.setActive(a.id, a.active, a.leftOn), (a) => a);
export const useSaveAttendance = () =>
  useWorkersMutation("attendance_save_day", (a: { date: string; marks: AttendanceMark[] }) => mock.saveDay(a.date, a.marks), (a) => a);
export const useGiveAdvance = () => useWorkersMutation("advance_create", mock.giveAdvance, (input) => ({ input }), [["transactions"]]);
export const useDeleteAdvance = () =>
  useWorkersMutation("advance_delete", (id: string) => mock.deleteAdvance(id), (id) => ({ id }), [["transactions"]]);

/* ── shared display helpers ── */
export const WAGE_TYPE_LABEL: Record<WageType, string> = { daily: "Daily", monthly: "Monthly", piece_rate: "Piece rate" };
export const WAGE_UNIT: Record<WageType, string> = { daily: "/day", monthly: "/month", piece_rate: "/pc" };
export const DEPARTMENTS: Department[] = ["Corrugation", "Printing", "Die Cutting", "Pasting", "Stitching", "Dispatch", "Maintenance", "Office"];
export const monthKey = (d: Date) => format(d, "yyyy-MM");
export const monthRange = (month: string) => {
  const d = parseISO(`${month}-01`);
  return { from: format(startOfMonth(d), "yyyy-MM-dd"), to: format(endOfMonth(d), "yyyy-MM-dd") };
};
