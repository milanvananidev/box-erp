import type { AttendanceRecord, PayrollAdjustment, PayrollLine, Worker } from "@/types/domain";
import type { Paise } from "./format";

export interface WageBreakdown {
  presentDays: number;
  halfDays: number;
  paidDays: number;
  overtimeHours: number;
  pieces: number;
  basic: Paise;
  overtime: Paise;
  gross: Paise;
  advanceDeduction: Paise;
  net: Paise;
}

/**
 * Pure wage calculation, shared by the dashboard, payroll screen and salary
 * slips so every screen shows the same number. The Rust layer will run the
 * same rules when payroll is finalised; keep both in sync.
 *
 *  daily       → rate × (present + ½ × half-days)
 *  monthly     → rate × paidDays / workingDays
 *  piece_rate  → rate × pieces
 *  overtime    → hours × OT rate (all wage types)
 *  advance     → recovered up to the gross amount; remainder carries forward
 */
export function calculateWage(
  worker: Worker,
  records: AttendanceRecord[],
  opts: { workingDays: number; advanceOutstanding: Paise },
): WageBreakdown {
  let presentDays = 0;
  let halfDays = 0;
  let overtimeHours = 0;
  let pieces = 0;
  for (const r of records) {
    if (r.status === "present") presentDays++;
    else if (r.status === "half_day") halfDays++;
    overtimeHours += r.overtimeHours;
    pieces += r.pieces ?? 0;
  }
  const paidDays = presentDays + halfDays * 0.5;

  let basic = 0;
  switch (worker.wageType) {
    case "daily":
      basic = worker.wageRate * paidDays;
      break;
    case "monthly":
      basic = opts.workingDays > 0 ? (worker.wageRate * paidDays) / opts.workingDays : 0;
      break;
    case "piece_rate":
      basic = worker.wageRate * pieces;
      break;
  }
  basic = Math.round(basic);
  const overtime = Math.round(worker.overtimeRatePerHour * overtimeHours);
  const gross = basic + overtime;
  const advanceDeduction = Math.min(opts.advanceOutstanding, gross);
  return { presentDays, halfDays, paidDays, overtimeHours, pieces, basic, overtime, gross, advanceDeduction, net: gross - advanceDeduction };
}

/**
 * Full payroll line for one worker and period.
 *  gross = basic + overtime + bonus
 *  advance recovery defaults to min(outstanding, gross − other deductions);
 *  an explicit override is clamped to the same limit so net pay is never negative.
 */
export function buildPayrollLine(
  worker: Worker,
  records: AttendanceRecord[],
  opts: { workingDays: number; expectedDays: number; advanceOutstanding: Paise; adjustment?: PayrollAdjustment },
): PayrollLine {
  const w = calculateWage(worker, records, { workingDays: opts.workingDays, advanceOutstanding: 0 });
  const adj = opts.adjustment ?? { bonus: 0, otherDeduction: 0 };
  const gross = w.basic + w.overtime + adj.bonus;
  const available = Math.max(0, gross - adj.otherDeduction);
  const maxRecovery = Math.min(opts.advanceOutstanding, available);
  const advanceDeduction = Math.max(0, Math.min(adj.advanceDeduction ?? maxRecovery, maxRecovery));
  const marked = records.length;
  return {
    workerId: worker.id,
    code: worker.code,
    name: worker.name,
    department: worker.department,
    designation: worker.designation,
    wageType: worker.wageType,
    wageRate: worker.wageRate,
    overtimeRatePerHour: worker.overtimeRatePerHour,
    presentDays: w.presentDays,
    halfDays: w.halfDays,
    absentDays: records.filter((r) => r.status === "absent").length,
    leaveDays: records.filter((r) => r.status === "leave").length,
    paidDays: w.paidDays,
    unmarkedDays: Math.max(0, opts.expectedDays - marked),
    overtimeHours: w.overtimeHours,
    pieces: w.pieces,
    basic: w.basic,
    overtime: w.overtime,
    bonus: adj.bonus,
    otherDeduction: adj.otherDeduction,
    otherDeductionNote: adj.otherDeductionNote,
    gross,
    advanceOutstanding: opts.advanceOutstanding,
    advanceDeduction,
    net: gross - adj.otherDeduction - advanceDeduction,
  };
}

/** Rupees in Indian words for salary slips: 12,345 → "Twelve Thousand Three Hundred Forty-Five Rupees Only". */
export function rupeesInWords(paise: Paise): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n]! : tens[Math.floor(n / 10)]! + (n % 10 ? `-${ones[n % 10]}` : ""));
  const three = (n: number) => (n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${two(n % 100)}` : ""}` : two(n));
  let r = Math.floor(Math.abs(paise) / 100);
  const p = Math.abs(paise) % 100;
  if (r === 0 && p === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(r / 1e7); r %= 1e7;
  const lakh = Math.floor(r / 1e5); r %= 1e5;
  const thousand = Math.floor(r / 1e3); r %= 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (r) parts.push(three(r));
  const rupees = parts.length ? `${parts.join(" ")} Rupees` : "";
  const paiseWords = p ? `${rupees ? " and " : ""}${two(p)} Paise` : "";
  return `${rupees}${paiseWords} Only`;
}
