/**
 * Domain model shared by the UI and (mirrored in) the Rust command layer.
 * All money is integer paise. All dates are ISO-8601 `yyyy-MM-dd` strings
 * unless noted; timestamps are full ISO strings.
 */
import type { Paise } from "@/lib/format";

export type ID = string;

/* ───────────────────────────── Finance ───────────────────────────── */

export type Direction = "in" | "out";
export type PaymentMode = "cash" | "bank" | "upi";

/**
 * How a cash movement is treated for profit calculation.
 *  - operating: real income / expense → counts toward P&L
 *  - advance:   salary advance given to a worker → cash out now, recovered from salary, never an expense
 *  - capital:   machinery purchase, owner capital → cash flow only (depreciation handled separately)
 *  - transfer:  bank ↔ cash, UPI settlement → moves money, zero effect on profit
 *  - loan:      loan received / repaid → cash flow only
 */
export type CashTreatment = "operating" | "advance" | "capital" | "transfer" | "loan";

/**
 * Where a record came from. Vyapar stays the billing / GST system; BoxERP only
 * mirrors payments so the dashboard is complete. Imported rows carry the
 * Vyapar reference so re-importing the same CSV is idempotent, and a manual
 * entry can be linked to an import to avoid double counting.
 */
export type TxnSource = "manual" | "vyapar_import";

export interface Transaction {
  id: ID;
  date: string;
  direction: Direction;
  amount: Paise;
  category: string;
  treatment: CashTreatment;
  mode: PaymentMode;
  partyId?: ID;
  partyName?: string;
  particulars: string;
  reference?: string;
  source: TxnSource;
  /** Vyapar voucher / receipt no. Unique per source → idempotent import key. */
  externalRef?: string;
  /** When a manual entry has been matched to an imported one, the import wins and this points to it. */
  matchedTo?: ID;
  /** Set when another module created the entry (advance, payroll, inventory); it can only be changed there. */
  origin?: { module: "advance" | "payroll" | "inventory"; refId: ID };
  createdAt: string;
}

export type PartyType = "customer" | "vendor";
export interface Party {
  id: ID;
  name: string;
  type: PartyType;
  phone?: string;
  gstin?: string;
}

export interface ExpenseCategory {
  id: ID;
  name: string;
  direction: Direction;
  treatment: CashTreatment;
}

/* ───────────────────────────── Workers & HR ───────────────────────────── */

export type WageType = "daily" | "monthly" | "piece_rate";
export type Department = "Corrugation" | "Printing" | "Die Cutting" | "Pasting" | "Stitching" | "Dispatch" | "Maintenance" | "Office";

export interface Worker {
  id: ID;
  code: string;
  name: string;
  department: Department;
  designation: string;
  joinedOn: string;
  wageType: WageType;
  /** Daily wage, monthly salary, or rate per piece, in paise. */
  wageRate: Paise;
  overtimeRatePerHour: Paise;
  active: boolean;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  /** Set when a worker leaves; inactive workers are hidden from attendance */
  leftOn?: string;
  notes?: string;
}

/**
 * Cash given to a worker ahead of salary. Creates a cash-out Transaction with
 * treatment "advance" (not an expense) and is recovered from later salaries.
 */
export interface SalaryAdvance {
  id: ID;
  workerId: ID;
  date: string;
  amount: Paise;
  mode: PaymentMode;
  note?: string;
  /** Amount already deducted in payroll runs */
  recovered: Paise;
  /** Cash-book entry created for this advance */
  transactionId: ID;
}

/** A salary payout recorded by payroll (one per worker per period). */
export interface SalaryPayment {
  id: ID;
  workerId: ID;
  /** Pay period, yyyy-MM */
  period: string;
  paidOn: string;
  gross: Paise;
  advanceDeduction: Paise;
  net: Paise;
  mode: PaymentMode;
  /** Cash-book batch entry this payout belongs to (one per pay date + mode) */
  transactionId?: ID;
}

/* ───────────────────────────── Payroll ───────────────────────────── */

export type PayrollRunStatus = "draft" | "finalized";

/** Optional manual adjustments on a payroll line. */
export interface PayrollAdjustment {
  bonus: Paise;
  otherDeduction: Paise;
  otherDeductionNote?: string;
  /** Override of the default advance recovery (default: as much as the pay allows) */
  advanceDeduction?: Paise;
}

export interface PayrollLine {
  workerId: ID;
  code: string;
  name: string;
  department: Department;
  designation: string;
  wageType: WageType;
  wageRate: Paise;
  overtimeRatePerHour: Paise;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  paidDays: number;
  /** Working days in the period with no attendance record */
  unmarkedDays: number;
  overtimeHours: number;
  pieces: number;
  basic: Paise;
  overtime: Paise;
  bonus: Paise;
  otherDeduction: Paise;
  otherDeductionNote?: string;
  /** basic + overtime + bonus */
  gross: Paise;
  advanceOutstanding: Paise;
  advanceDeduction: Paise;
  /** gross − otherDeduction − advanceDeduction */
  net: Paise;
  paymentId?: ID;
}

/**
 * One month of payroll. Drafts are recalculated from attendance on every
 * read; finalising freezes the lines so later attendance edits can't change
 * a salary that has been approved or paid.
 */
export interface PayrollRun {
  id: ID;
  period: string; // yyyy-MM
  status: PayrollRunStatus;
  workingDays: number;
  lines: PayrollLine[];
  finalizedOn?: string;
}

export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export interface AttendanceRecord {
  id: ID;
  workerId: ID;
  date: string;
  status: AttendanceStatus;
  overtimeHours: number;
  pieces?: number;
}

/* ───────────────────────────── Production ───────────────────────────── */

export type ProductionStage =
  | "planned"
  | "corrugation"
  | "printing"
  | "cutting"
  | "pasting"
  | "bundling"
  | "completed"
  | "on_hold";

export interface BoxSpec {
  ply: 3 | 5 | 7;
  /** Inner dimensions, millimetres */
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  flute: "A" | "B" | "C" | "E" | "BC";
  gsm: number;
  printed: boolean;
  colors?: number;
}

export type OrderPriority = "normal" | "urgent";

export interface ProductionOrder {
  id: ID;
  orderNo: string;
  customer: string;
  /** Customer PO / Vyapar sales order reference (billing itself stays in Vyapar) */
  customerRef?: string;
  product: string;
  spec: BoxSpec;
  plannedQty: number;
  /** Denormalised sums of the production log, kept in sync on every entry */
  producedQty: number;
  wastageQty: number;
  stage: ProductionStage;
  /** Stage to return to when an on-hold order is resumed */
  heldFromStage?: ProductionStage;
  holdReason?: string;
  priority: OrderPriority;
  startDate: string;
  dueDate: string;
  completedOn?: string;
  notes?: string;
  createdAt: string;
}

/** One shift/day of output against an order. Source of truth for produced & wastage. */
export interface ProductionEntry {
  id: ID;
  orderId: ID;
  date: string;
  stage: ProductionStage;
  goodQty: number;
  wastageQty: number;
  wastageReason?: WastageReason;
  note?: string;
  createdAt: string;
}

export type WastageReason = "board_defect" | "print_misregister" | "die_cut_error" | "machine_setup" | "handling_damage" | "other";

/* ───────────────────────────── Inventory ───────────────────────────── */

export type MaterialCategory = "Paper Roll" | "Gum & Adhesive" | "Ink" | "Stitching Wire" | "Strapping" | "Consumable";

export interface Material {
  id: ID;
  code: string;
  name: string;
  category: MaterialCategory;
  unit: "kg" | "roll" | "litre" | "pcs" | "bag";
  /** Current balance, kept in sync with the stock ledger */
  stock: number;
  reorderLevel: number;
  /** Weighted-average cost per unit, recalculated on every inward */
  avgCost: Paise;
  /** Paper-roll specifics */
  gsm?: number;
  bf?: number;
  deckleInch?: number;
  preferredVendorId?: ID;
  active: boolean;
  notes?: string;
}

export type MovementType = "opening" | "inward" | "issue" | "adjustment";
export type AdjustmentReason = "stock_count" | "damage" | "moisture_loss" | "return_to_vendor" | "other";

/**
 * Stock ledger entry. Quantity is signed (+ in, − out); value uses the
 * purchase rate for inwards and the running average cost for issues.
 */
export interface StockMovement {
  id: ID;
  materialId: ID;
  date: string;
  type: MovementType;
  qty: number;
  rate: Paise;
  value: Paise;
  balanceAfter: number;
  vendorId?: ID;
  vendorName?: string;
  billNo?: string;
  reels?: number;
  /** Production order the material was issued to */
  orderId?: ID;
  orderNo?: string;
  reason?: AdjustmentReason;
  note?: string;
  /** Cash-book entry when the purchase was paid at the time of inward */
  transactionId?: ID;
  createdAt: string;
}

/* ───────────────────────────── Dashboard ───────────────────────────── */

export interface KpiDelta {
  value: number;
  /** % change vs comparison period; null when there is no baseline */
  changePct: number | null;
}

export interface DashboardSummary {
  asOf: string;
  cashIn: KpiDelta;
  cashOut: KpiDelta;
  operatingProfit: KpiDelta;
  productionToday: KpiDelta;
  attendance: { present: number; absent: number; halfDay: number; leave: number; total: number };
  salaryPending: {
    amount: Paise;
    workers: number;
    advancesOutstanding: Paise;
    dueOn: string;
    /** Finalised but not yet paid, from earlier months */
    unpaid: { amount: Paise; workers: number };
  };
  production: { planned: number; produced: number; wastage: number };
}

export interface CashFlowPoint {
  label: string;
  start: string;
  cashIn: Paise;
  cashOut: Paise;
}

export interface PendingSalary {
  workerId: ID;
  name: string;
  department: Department;
  netPayable: Paise;
}
