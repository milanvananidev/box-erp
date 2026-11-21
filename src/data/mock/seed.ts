/**
 * Deterministic mock data. Everything is generated relative to "today" so the
 * dashboard always looks current, but uses a seeded PRNG so screenshots and
 * reviews are reproducible run to run.
 */
import { addDays, differenceInCalendarDays, eachDayOfInterval, endOfMonth, format, isSunday, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { buildPayrollLine } from "@/lib/payroll";
import { paperPerBox } from "@/lib/production";
import { toPaise } from "@/lib/format";
import type {
  AttendanceRecord,
  ExpenseCategory,
  Material,
  Party,
  PaymentMode,
  PayrollRun,
  ProductionEntry,
  SalaryAdvance,
  SalaryPayment,
  StockMovement,
  ProductionOrder,
  WastageReason,
  Transaction,
  Worker,
} from "@/types/domain";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20250127);
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export const TODAY = new Date();
export const todayISO = iso(TODAY);

/* ── Parties ── */
export const parties: Party[] = [
  { id: "c1", name: "Shakti Industries", type: "customer", gstin: "24AAKCS1234F1Z5" },
  { id: "c2", name: "Metro Foods Pvt Ltd", type: "customer", gstin: "24AABCM5678K1Z2" },
  { id: "c3", name: "Aarya Exports", type: "customer" },
  { id: "c4", name: "Ganesh Pharma", type: "customer" },
  { id: "c5", name: "Patel Ceramics", type: "customer" },
  { id: "c6", name: "Kiran Agro Products", type: "customer" },
  { id: "v1", name: "Shree Kraft Paper Mills", type: "vendor" },
  { id: "v2", name: "Ambica Starch & Gum", type: "vendor" },
  { id: "v3", name: "Colorjet Inks", type: "vendor" },
  { id: "v4", name: "PGVCL (Electricity)", type: "vendor" },
  { id: "v5", name: "Rajdhani Transport", type: "vendor" },
  { id: "v6", name: "Om Packaging Supplies", type: "vendor" },
];

export const categories: ExpenseCategory[] = [
  { id: "sales", name: "Sales Receipt", direction: "in", treatment: "operating" },
  { id: "scrap", name: "Scrap Sale", direction: "in", treatment: "operating" },
  { id: "loan_in", name: "Loan Received", direction: "in", treatment: "loan" },
  { id: "raw", name: "Raw Material", direction: "out", treatment: "operating" },
  { id: "wages", name: "Wages & Salary", direction: "out", treatment: "operating" },
  { id: "advance", name: "Salary Advance", direction: "out", treatment: "advance" },
  { id: "power", name: "Electricity", direction: "out", treatment: "operating" },
  { id: "transport", name: "Transport & Freight", direction: "out", treatment: "operating" },
  { id: "maint", name: "Repairs & Maintenance", direction: "out", treatment: "operating" },
  { id: "rent", name: "Rent", direction: "out", treatment: "operating" },
  { id: "machinery", name: "Machinery Purchase", direction: "out", treatment: "capital" },
  { id: "misc", name: "Miscellaneous", direction: "out", treatment: "operating" },
];

/* ── Transactions (≈ 6 months) ── */
function buildTransactions(): Transaction[] {
  const out: Transaction[] = [];
  let n = 1;
  const push = (t: Omit<Transaction, "id" | "createdAt">) =>
    out.push({ ...t, id: `t${n++}`, createdAt: `${t.date}T10:00:00.000Z` });

  for (let i = 180; i >= 0; i--) {
    const d = subDays(TODAY, i);
    if (isSunday(d)) continue;
    const date = iso(d);
    const customers = parties.filter((p) => p.type === "customer");

    // Customer receipts — mostly from Vyapar import, a few manual cash ones
    if (rand() < 0.6) {
      const c = pick(customers);
      const imported = rand() < 0.75;
      push({
        date, direction: "in", amount: toPaise(between(50, 320) * 1000), category: "Sales Receipt",
        treatment: "operating", mode: imported ? pick(["bank", "upi"] as const) : "cash",
        partyId: c.id, partyName: c.name, particulars: `Payment from ${c.name}`,
        source: imported ? "vyapar_import" : "manual",
        externalRef: imported ? `VY-RCPT-${1000 + n}` : undefined,
      });
    }
    if (rand() < 0.35) {
      push({
        date, direction: "out", amount: toPaise(between(70, 230) * 1000), category: "Raw Material",
        treatment: "operating", mode: "bank", partyId: "v1", partyName: "Shree Kraft Paper Mills",
        particulars: "Material Purchase – Kraft Paper", source: "manual",
      });
    }
    if (rand() < 0.18) {
      push({
        date, direction: "out", amount: toPaise(between(8, 30) * 1000), category: "Raw Material",
        treatment: "operating", mode: pick(["bank", "upi"] as const), partyId: "v2", partyName: "Ambica Starch & Gum",
        particulars: "Starch gum – 25 kg bags", source: "manual",
      });
    }
    if (rand() < 0.22) {
      push({
        date, direction: "out", amount: toPaise(between(4, 18) * 1000), category: "Transport & Freight",
        treatment: "operating", mode: pick(["cash", "upi"] as const), partyId: "v5", partyName: "Rajdhani Transport",
        particulars: "Dispatch freight", source: "manual",
      });
    }
    if (rand() < 0.05) {
      push({
        date, direction: "in", amount: toPaise(between(6, 22) * 1000), category: "Scrap Sale",
        treatment: "operating", mode: "cash", particulars: "Waste paper scrap sale", source: "manual",
      });
    }
    if (d.getDate() === 7) {
      push({ date, direction: "out", amount: toPaise(between(34, 44) * 1000), category: "Electricity", treatment: "operating",
        mode: "bank", partyId: "v4", partyName: "PGVCL (Electricity)", particulars: "Electricity Bill", source: "manual" });
      // Older months only; recent payouts come from the seeded payroll runs below.
      if (date < iso(startOfMonth(subMonths(TODAY, 1))))
        push({ date, direction: "out", amount: toPaise(460 * 1000), category: "Wages & Salary", treatment: "operating",
          mode: "bank", particulars: "Monthly salary disbursement", source: "manual" });
    }
    if (d.getDate() === 1) {
      push({ date, direction: "out", amount: toPaise(45000), category: "Rent", treatment: "operating", mode: "bank",
        particulars: "Factory shed rent", source: "manual" });
    }
  }
  // One capital purchase so cash-flow vs profit difference is visible
  push({ date: iso(subDays(TODAY, 40)), direction: "out", amount: toPaise(385000), category: "Machinery Purchase",
    treatment: "capital", mode: "bank", particulars: "Rotary die-cutter (part payment)", source: "manual" });

  // Guarantee a few entries today for the dashboard
  const today = iso(TODAY);
  push({ date: today, direction: "out", amount: toPaise(240000), category: "Raw Material", treatment: "operating", mode: "bank",
    partyId: "v1", partyName: "Shree Kraft Paper Mills", particulars: "Material Purchase – Kraft Paper", source: "manual" });
  push({ date: today, direction: "out", amount: toPaise(38500), category: "Electricity", treatment: "operating", mode: "bank",
    partyId: "v4", partyName: "PGVCL (Electricity)", particulars: "Electricity Bill", source: "manual" });
  push({ date: today, direction: "in", amount: toPaise(300000), category: "Sales Receipt", treatment: "operating", mode: "bank",
    partyId: "c1", partyName: "Shakti Industries", particulars: "Payment from Shakti Industries", source: "vyapar_import",
    externalRef: "VY-RCPT-9001" });

  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
}

/* ── Workers ── */
const workerNames = [
  "Ramesh Patel", "Suresh Yadav", "Mahesh Thakor", "Dinesh Solanki", "Kiran Parmar", "Vijay Chauhan",
  "Anil Rathod", "Sunil Vaghela", "Prakash Makwana", "Rajesh Gohil", "Bharat Desai", "Jignesh Prajapati",
  "Hitesh Bhatt", "Nilesh Joshi", "Manoj Kumar", "Santosh Gupta", "Ravi Shankar", "Ajay Mishra",
  "Pooja Rana", "Geeta Ben", "Savita Devi", "Kanta Ben", "Lalita Vasava", "Meena Parmar",
  "Arvind Bariya", "Deepak Mali", "Mukesh Rawal", "Naresh Damor", "Pankaj Sharma", "Rakesh Kori",
  "Imran Shaikh", "Salim Pathan",
] as const;

const deptPlan: Array<[Worker["department"], string, Worker["wageType"], number]> = [
  ["Corrugation", "Corrugator Operator", "daily", 650],
  ["Corrugation", "Helper", "daily", 480],
  ["Printing", "Printer Operator", "monthly", 22000],
  ["Die Cutting", "Die Cutter", "daily", 600],
  ["Pasting", "Pasting Worker", "piece_rate", 0.45],
  ["Stitching", "Stitching Worker", "piece_rate", 0.35],
  ["Dispatch", "Loader", "daily", 500],
  ["Maintenance", "Fitter", "monthly", 18000],
];

export const workers: Worker[] = workerNames.map((name, i) => {
  const [department, designation, wageType, rate] = i === 31 ? (["Office", "Accountant", "monthly", 25000] as const) : deptPlan[i % deptPlan.length]!;
  return {
    id: `w${i + 1}`,
    code: `EMP-${String(101 + i).padStart(4, "0")}`,
    name,
    department,
    designation,
    joinedOn: iso(subDays(TODAY, between(60, 1800))),
    wageType,
    wageRate: toPaise(rate),
    overtimeRatePerHour: toPaise(wageType === "monthly" ? 120 : 80),
    active: true,
    phone: `9${String(8000000000 + Math.floor(rand() * 999999999)).slice(0, 9)}`,
    address: pick(["Shapar", "Metoda GIDC", "Kotharia", "Lodhika", "Rajkot"]) + ", Gujarat",
  };
});
// one former employee so inactive filtering has something to show
workers.push({
  id: "w33", code: "EMP-0133", name: "Gopal Vala", department: "Dispatch", designation: "Loader",
  joinedOn: iso(subDays(TODAY, 700)), wageType: "daily", wageRate: toPaise(480), overtimeRatePerHour: toPaise(80),
  active: false, leftOn: iso(subDays(TODAY, 45)), phone: "9825011223",
});

/* ── Salary advances ── */
export const advances: SalaryAdvance[] = workers
  .filter((w, i) => w.active && i % 4 === 0)
  .flatMap((w, i) => {
    const first = toPaise(2000 + (i % 3) * 1000);
    const list: SalaryAdvance[] = [
      { id: `adv-${w.id}-1`, workerId: w.id, date: iso(subDays(TODAY, 40 + i)), amount: first, mode: "cash", recovered: first, transactionId: `t-adv-${w.id}-1`, note: "Festival advance" },
      { id: `adv-${w.id}-2`, workerId: w.id, date: iso(subDays(TODAY, 6 + (i % 9))), amount: toPaise(1000 + (i % 3) * 1000), mode: i % 2 ? "upi" : "cash", recovered: 0, transactionId: `t-adv-${w.id}-2` },
    ];
    return list;
  });

export const advanceBalance = (workerId: string) =>
  advances.filter((a) => a.workerId === workerId).reduce((s, a) => s + a.amount - a.recovered, 0);

/* ── Salary payments: filled from the seeded payroll runs at the bottom of this file ── */
export const salaryPayments: SalaryPayment[] = [];

/* ── Attendance (current month to date) ── */
function buildAttendance(): AttendanceRecord[] {
  const out: AttendanceRecord[] = [];
  for (let i = 120; i >= 0; i--) {
    const d = subDays(TODAY, i);
    if (isSunday(d)) continue;
    const date = iso(d);
    workers.forEach((w, idx) => {
      if (!w.active && (!w.leftOn || date > w.leftOn)) return;
      if (date < w.joinedOn) return;
      let status: AttendanceRecord["status"];
      if (i === 0) {
        // today: 28 present (incl. 1 half day), 3 absent, 1 on leave
        status = idx < 27 ? "present" : idx === 27 ? "half_day" : idx === 31 ? "leave" : "absent";
      } else {
        const r = rand();
        status = r < 0.86 ? "present" : r < 0.92 ? "half_day" : r < 0.97 ? "absent" : "leave";
      }
      out.push({
        id: `a-${date}-${w.id}`,
        workerId: w.id,
        date,
        status,
        overtimeHours: status === "present" && rand() < 0.2 ? between(1, 3) : 0,
        pieces: w.wageType === "piece_rate" && status !== "absent" && status !== "leave" ? between(900, 1600) : undefined,
      });
    });
  }
  return out;
}

/* ── Production ── */
type SeedOrder = Omit<ProductionOrder, "priority" | "createdAt"> & Partial<Pick<ProductionOrder, "priority">>;
const seedOrders: SeedOrder[] = [
  { id: "p1", orderNo: "PO-1046", customer: "Shakti Industries", customerRef: "SO-2231", product: "5 Ply Box", spec: { ply: 5, lengthMm: 450, widthMm: 300, heightMm: 300, flute: "BC", gsm: 150, printed: false }, plannedQty: 10000, producedQty: 6200, wastageQty: 140, stage: "cutting", startDate: iso(subDays(TODAY, 2)), dueDate: iso(addDays(TODAY, 2)), priority: "urgent" },
  { id: "p2", orderNo: "PO-1045", customer: "Metro Foods Pvt Ltd", product: "3 Ply Box", spec: { ply: 3, lengthMm: 300, widthMm: 200, heightMm: 150, flute: "B", gsm: 120, printed: true, colors: 2 }, plannedQty: 5000, producedQty: 2100, wastageQty: 60, stage: "printing", startDate: iso(subDays(TODAY, 1)), dueDate: iso(addDays(TODAY, 3)) },
  { id: "p3", orderNo: "PO-1044", customer: "Aarya Exports", customerRef: "AE/PO/889", product: "5 Ply Printed Box", spec: { ply: 5, lengthMm: 600, widthMm: 400, heightMm: 400, flute: "BC", gsm: 180, printed: true, colors: 3 }, plannedQty: 15000, producedQty: 0, wastageQty: 0, stage: "planned", startDate: iso(TODAY), dueDate: iso(addDays(TODAY, 8)) },
  { id: "p4", orderNo: "PO-1043", customer: "Ganesh Pharma", product: "3 Ply Mono Carton", spec: { ply: 3, lengthMm: 220, widthMm: 160, heightMm: 120, flute: "E", gsm: 120, printed: true, colors: 4 }, plannedQty: 20000, producedQty: 18400, wastageQty: 410, stage: "pasting", startDate: iso(subDays(TODAY, 5)), dueDate: iso(addDays(TODAY, 1)), priority: "urgent" },
  { id: "p5", orderNo: "PO-1042", customer: "Patel Ceramics", product: "7 Ply Heavy Duty Box", spec: { ply: 7, lengthMm: 800, widthMm: 500, heightMm: 450, flute: "BC", gsm: 200, printed: false }, plannedQty: 3000, producedQty: 3000, wastageQty: 55, stage: "completed", startDate: iso(subDays(TODAY, 9)), dueDate: iso(subDays(TODAY, 1)), completedOn: iso(subDays(TODAY, 2)) },
  { id: "p6", orderNo: "PO-1041", customer: "Kiran Agro Products", product: "5 Ply Box", spec: { ply: 5, lengthMm: 500, widthMm: 350, heightMm: 300, flute: "BC", gsm: 150, printed: true, colors: 1 }, plannedQty: 8000, producedQty: 4300, wastageQty: 120, stage: "on_hold", heldFromStage: "printing", holdReason: "Waiting for customer artwork approval", startDate: iso(subDays(TODAY, 6)), dueDate: iso(subDays(TODAY, 0)) },
  { id: "p7", orderNo: "PO-1040", customer: "Shakti Industries", product: "3 Ply Box", spec: { ply: 3, lengthMm: 350, widthMm: 250, heightMm: 200, flute: "B", gsm: 120, printed: false }, plannedQty: 12000, producedQty: 12000, wastageQty: 230, stage: "completed", startDate: iso(subDays(TODAY, 14)), dueDate: iso(subDays(TODAY, 8)), completedOn: iso(subDays(TODAY, 8)) },
  { id: "p8", orderNo: "PO-1039", customer: "Metro Foods Pvt Ltd", product: "5 Ply Printed Box", spec: { ply: 5, lengthMm: 400, widthMm: 300, heightMm: 250, flute: "BC", gsm: 150, printed: true, colors: 2 }, plannedQty: 6000, producedQty: 6000, wastageQty: 190, stage: "completed", startDate: iso(subDays(TODAY, 18)), dueDate: iso(subDays(TODAY, 11)), completedOn: iso(subDays(TODAY, 12)) },
];
export const productionOrders: ProductionOrder[] = seedOrders.map((o) => ({
  ...o,
  priority: o.priority ?? "normal",
  createdAt: `${o.startDate}T09:00:00.000Z`,
}));

/** Production log consistent with each order's produced / wastage totals. */
export const productionEntries: ProductionEntry[] = productionOrders.flatMap((o) => {
  if (o.producedQty === 0 && o.wastageQty === 0) return [];
  const days = Math.max(1, Math.min(4, differenceInCalendarDays(parseISO(o.completedOn ?? todayISO), parseISO(o.startDate)) + 1));
  const reasons: WastageReason[] = ["board_defect", "machine_setup", "print_misregister", "die_cut_error"];
  let goodLeft = o.producedQty;
  let wasteLeft = o.wastageQty;
  return Array.from({ length: days }, (_, i) => {
    const last = i === days - 1;
    const good = last ? goodLeft : Math.round(o.producedQty / days / 50) * 50;
    const waste = last ? wasteLeft : Math.round(o.wastageQty / days);
    goodLeft -= good;
    wasteLeft -= waste;
    const date = iso(addDays(parseISO(o.startDate), i));
    return {
      id: `pe-${o.id}-${i}`,
      orderId: o.id,
      date,
      stage: o.stage === "completed" ? (i === days - 1 ? "bundling" : "corrugation") : (o.heldFromStage ?? o.stage),
      goodQty: good,
      wastageQty: waste,
      wastageReason: waste > 0 ? reasons[i % reasons.length] : undefined,
      createdAt: `${date}T17:30:00.000Z`,
    } satisfies ProductionEntry;
  });
});

/** Planned vs produced for the whole month (includes completed orders not listed above). */
export const monthProduction = { planned: 160000, produced: 125000, wastage: 2900, today: 12500, yesterday: 10890 };

/* ── Inventory ── */
const seedMaterials: Omit<Material, "active">[] = [
  { id: "m1", code: "KP-120", name: "Kraft Paper 120 GSM", category: "Paper Roll", unit: "kg", stock: 8400, reorderLevel: 5000, avgCost: toPaise(38), gsm: 120, bf: 18, deckleInch: 36, preferredVendorId: "v1" },
  { id: "m2", code: "KP-150", name: "Kraft Paper 150 GSM", category: "Paper Roll", unit: "kg", stock: 3100, reorderLevel: 4000, avgCost: toPaise(41), gsm: 150, bf: 20, deckleInch: 42, preferredVendorId: "v1" },
  { id: "m3", code: "DP-180", name: "Duplex Board 180 GSM", category: "Paper Roll", unit: "kg", stock: 2250, reorderLevel: 1500, avgCost: toPaise(56), gsm: 180, deckleInch: 40, preferredVendorId: "v1" },
  { id: "m4", code: "GUM-ST", name: "Corrugation Starch Gum", category: "Gum & Adhesive", unit: "bag", stock: 18, reorderLevel: 25, avgCost: toPaise(1350), preferredVendorId: "v2" },
  { id: "m5", code: "INK-BLK", name: "Flexo Ink – Black", category: "Ink", unit: "litre", stock: 42, reorderLevel: 20, avgCost: toPaise(310), preferredVendorId: "v3" },
  { id: "m6", code: "INK-RED", name: "Flexo Ink – Red", category: "Ink", unit: "litre", stock: 9, reorderLevel: 15, avgCost: toPaise(340), preferredVendorId: "v3" },
  { id: "m7", code: "SW-18", name: "Stitching Wire 18 SWG", category: "Stitching Wire", unit: "kg", stock: 120, reorderLevel: 60, avgCost: toPaise(98), preferredVendorId: "v6" },
  { id: "m8", code: "STP-12", name: "PP Strapping Roll 12mm", category: "Strapping", unit: "roll", stock: 14, reorderLevel: 10, avgCost: toPaise(720), preferredVendorId: "v6" },
];
export const materials: Material[] = seedMaterials.map((m) => ({ ...m, active: true }));

/**
 * Ledger for the last ~90 days that ends exactly at each material's seeded
 * stock: an opening balance, periodic inwards from the usual vendor, and
 * frequent issues (paper issued against the production order running that day).
 */
export const stockMovements: StockMovement[] = (() => {
  const out: StockMovement[] = [];
  let n = 1;
  const typical: Record<string, [number, number, number, number]> = {
    // [unused, unused, issue min, issue max] per working day
    m1: [3000, 6000, 150, 600], m2: [3000, 5000, 150, 500], m3: [1000, 2000, 60, 200],
    m4: [20, 40, 1, 4], m5: [20, 40, 1, 4], m6: [15, 30, 1, 3], m7: [50, 100, 3, 10], m8: [10, 20, 1, 2],
  };
  const vendorName = (id?: string) => parties.find((p) => p.id === id)?.name;
  for (const m of materials) {
    const [, , isMin, isMax] = typical[m.id]!;
    const events: Array<{ date: string; qty: number; type: "inward" | "issue"; rate?: number; orderId?: string }> = [];
    for (let i = 88; i >= 0; i--) {
      const d = subDays(TODAY, i);
      if (isSunday(d)) continue;
      if (i % 15 === 7) events.push({ date: iso(d), type: "inward", qty: 0, rate: Math.round(m.avgCost * (0.95 + rand() * 0.1)) });
      if (m.category !== "Paper Roll" && rand() < 0.6) events.push({ date: iso(d), type: "issue", qty: -between(isMin, isMax) });
    }
    if (m.category === "Paper Roll") {
      // Paper is issued against the order being run: what the logged output needed, plus a little extra.
      for (const e of productionEntries) {
        const o = productionOrders.find((x) => x.id === e.orderId)!;
        const forThis = o.spec.gsm <= 120 ? "m1" : o.spec.gsm === 180 ? "m3" : "m2";
        if (forThis !== m.id || e.date < iso(subDays(TODAY, 88))) continue;
        const kg = Math.round((paperPerBox(o.spec) * (e.goodQty + e.wastageQty) * (0.99 + rand() * 0.08)) / 1000);
        if (kg > 0) events.push({ date: e.date, type: "issue", qty: -kg, orderId: o.id } as (typeof events)[number]);
      }
      events.sort((x, y) => x.date.localeCompare(y.date));
    }
    // Size the inwards so the ledger lands exactly on today's seeded stock.
    let opening = Math.round(m.reorderLevel * 1.3);
    const issued = -events.filter((e) => e.type === "issue").reduce((a, e) => a + e.qty, 0);
    const inwards = events.filter((e) => e.type === "inward");
    const toReceive = Math.max(0, m.stock + issued - opening);
    inwards.forEach((e, i) => { e.qty = i === inwards.length - 1 ? toReceive - Math.floor(toReceive / inwards.length) * (inwards.length - 1) : Math.floor(toReceive / inwards.length); });
    for (let i = events.length - 1; i >= 0; i--) if (events[i]!.type === "inward" && events[i]!.qty <= 0) events.splice(i, 1);
    // keep the running balance at or above zero
    let run = opening, low = opening;
    for (const e of events) { run += e.qty; low = Math.min(low, run); }
    if (low < 0) opening -= low;
    let bal = opening;
    let avg = m.avgCost;
    const openDate = iso(subDays(TODAY, 90));
    out.push({ id: `sm${n++}`, materialId: m.id, date: openDate, type: "opening", qty: opening, rate: avg, value: opening * avg, balanceAfter: opening, note: "Opening balance", createdAt: `${openDate}T08:00:00.000Z` });
    for (const e of events) {
      if (e.type === "inward") {
        avg = Math.round((bal * avg + e.qty * e.rate!) / (bal + e.qty));
        bal += e.qty;
        const vid = m.preferredVendorId;
        out.push({
          id: `sm${n++}`, materialId: m.id, date: e.date, type: "inward", qty: e.qty, rate: e.rate!, value: e.qty * e.rate!, balanceAfter: bal,
          vendorId: vid, vendorName: vendorName(vid), billNo: `B-${between(1000, 9999)}`, reels: m.category === "Paper Roll" ? Math.max(1, Math.round(e.qty / 450)) : undefined,
          createdAt: `${e.date}T10:00:00.000Z`,
        });
      } else {
        bal += e.qty;
        const order = e.orderId ? productionOrders.find((o) => o.id === e.orderId) : undefined;
        out.push({
          id: `sm${n++}`, materialId: m.id, date: e.date, type: "issue", qty: e.qty, rate: avg, value: e.qty * avg, balanceAfter: bal,
          orderId: order?.id, orderNo: order?.orderNo, note: order ? undefined : "General use", createdAt: `${e.date}T14:00:00.000Z`,
        });
      }
    }
    if (bal !== m.stock) {
      // physical count difference, booked as a stock-count adjustment
      const diff = m.stock - bal;
      bal = m.stock;
      out.push({ id: `sm${n++}`, materialId: m.id, date: todayISO, type: "adjustment", qty: diff, rate: avg, value: diff * avg, balanceAfter: bal, reason: "stock_count", note: "Physical stock count", createdAt: `${todayISO}T08:30:00.000Z` });
    }
    m.avgCost = avg;
  }
  return out;
})();

export const attendance: AttendanceRecord[] = buildAttendance();

/* ── Payroll: last two months finalised; a few October-style payouts still pending ── */
const UNPAID_LAST_MONTH = new Set(["w5", "w12", "w19", "w27"]);
export const payrollRuns: PayrollRun[] = [2, 1].map((m) => {
  const month = subMonths(TODAY, m);
  const period = format(month, "yyyy-MM");
  const from = iso(startOfMonth(month));
  const to = iso(endOfMonth(month));
  const wd = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).filter((d) => !isSunday(d)).length;
  const lines = workers
    .filter((w) => w.joinedOn <= to && (!w.leftOn || w.leftOn >= from))
    .map((w) => {
      const recs = attendance.filter((a) => a.workerId === w.id && a.date >= from && a.date <= to);
      // advances recovered in the most recent closed month
      const recovered = m === 1 ? advances.filter((a) => a.workerId === w.id && a.recovered > 0).reduce((s, a) => s + a.recovered, 0) : 0;
      const expected = eachDayOfInterval({ start: parseISO(w.joinedOn > from ? w.joinedOn : from), end: parseISO(w.leftOn && w.leftOn < to ? w.leftOn : to) }).filter((d) => !isSunday(d)).length;
      return buildPayrollLine(w, recs, { workingDays: wd, expectedDays: expected, advanceOutstanding: recovered });
    });
  return { id: `run-${period}`, period, status: "finalized" as const, workingDays: wd, lines, finalizedOn: iso(endOfMonth(month)) };
});

const salaryBatchTxns: Transaction[] = [];
for (const run of payrollRuns) {
  const paidOn = `${format(addDays(parseISO(`${run.period}-28`), 7), "yyyy-MM")}-07`;
  const lastMonth = run.period === format(subMonths(TODAY, 1), "yyyy-MM");
  const byMode = new Map<PaymentMode, { total: number; count: number }>();
  for (const line of run.lines) {
    if (lastMonth && UNPAID_LAST_MONTH.has(line.workerId)) continue;
    const mode: PaymentMode = line.wageType === "monthly" ? "bank" : "cash";
    const txnId = `t-sal-${run.period}-${mode}`;
    const pay: SalaryPayment = {
      id: `sp-${line.workerId}-${run.period}`, workerId: line.workerId, period: run.period, paidOn,
      gross: line.gross, advanceDeduction: line.advanceDeduction, net: line.net, mode, transactionId: txnId,
    };
    salaryPayments.push(pay);
    line.paymentId = pay.id;
    const b = byMode.get(mode) ?? { total: 0, count: 0 };
    byMode.set(mode, { total: b.total + line.net, count: b.count + 1 });
  }
  for (const [mode, b] of byMode)
    salaryBatchTxns.push({
      id: `t-sal-${run.period}-${mode}`, date: paidOn, direction: "out", amount: b.total, category: "Wages & Salary", treatment: "operating",
      mode, particulars: `Salary ${format(parseISO(`${run.period}-01`), "MMM yyyy")} – ${b.count} workers`, source: "manual", createdAt: `${paidOn}T12:00:00.000Z`,
      origin: { module: "payroll", refId: run.period },
    });
}

export const transactions: Transaction[] = [
  ...buildTransactions(),
  ...salaryBatchTxns,
  ...advances.map<Transaction>((a) => ({
    id: a.transactionId, date: a.date, direction: "out", amount: a.amount, category: "Salary Advance", treatment: "advance",
    mode: a.mode, particulars: `Advance – ${workers.find((w) => w.id === a.workerId)!.name}`, source: "manual", createdAt: `${a.date}T11:00:00.000Z`,
    origin: { module: "advance", refId: a.id },
  })),
].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
