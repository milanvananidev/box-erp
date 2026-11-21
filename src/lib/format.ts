import { format, parseISO } from "date-fns";

/** Amounts are stored as integer paise to avoid floating point drift. */
export type Paise = number;

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("en-IN");

export const toPaise = (rupees: number): Paise => Math.round(rupees * 100);
export const fromPaise = (p: Paise) => p / 100;

/** ₹ 8,50,000 — Formats paise amounts with ₹ symbol and Indian numbering commas */
export function formatINR(p: Paise, opts: { precise?: boolean; sign?: boolean } = {}) {
  const r = fromPaise(p);
  const abs = Math.abs(r);
  const body = opts.precise ? inrPrecise.format(abs) : inr.format(abs);
  const sign = r < 0 ? "−" : opts.sign && r > 0 ? "+" : "";
  return `${sign}₹ ${body}`;
}

/**
 * Format standard rupee amounts (floating or integer rupees, e.g. from box costing)
 * with ₹ symbol and Indian numbering commas: e.g. ₹ 1,250.50
 */
export function formatRupees(amount: number, opts: { decimals?: number; sign?: boolean } = {}) {
  const dec = opts.decimals ?? 2;
  const abs = Math.abs(amount);
  const formatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  const sign = amount < 0 ? "−" : opts.sign && amount > 0 ? "+" : "";
  return `${sign}₹ ${formatter.format(abs)}`;
}

/** Compact Indian notation for chart axes: ₹ 8.5 L, ₹ 1.2 Cr, ₹ 45 K */
export function formatINRCompact(p: Paise) {
  const r = fromPaise(p);
  const abs = Math.abs(r);
  const sign = r < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹ ${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹ ${trim(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}₹ ${trim(abs / 1e3)} K`;
  return `${sign}₹ ${inr.format(abs)}`;
}

const trim = (n: number) => (Math.round(n * 10) / 10).toString();

export const formatQty = (n: number, unit?: string) => `${qty.format(n)}${unit ? ` ${unit}` : ""}`;

export const formatPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

const asDate = (d: string | Date) => (typeof d === "string" ? parseISO(d) : d);
export const formatDate = (d: string | Date) => format(asDate(d), "dd MMM yyyy");
export const formatDateShort = (d: string | Date) => format(asDate(d), "dd MMM");
export const formatDayLong = (d: string | Date) => format(asDate(d), "EEE, d MMM yyyy");
