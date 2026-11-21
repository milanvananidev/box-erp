import { format, parseISO } from "date-fns";

/** Amounts are stored as integer paise to avoid floating point drift. */
export type Paise = number;

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("en-IN");

export const toPaise = (rupees: number): Paise => Math.round(rupees * 100);
export const fromPaise = (p: Paise) => p / 100;

/** ₹ 8,50,000 */
export function formatINR(p: Paise, opts: { precise?: boolean; sign?: boolean } = {}) {
  const r = fromPaise(p);
  const abs = Math.abs(r);
  const body = opts.precise ? inrPrecise.format(abs) : inr.format(abs);
  const sign = r < 0 ? "−" : opts.sign && r > 0 ? "+" : "";
  return `${sign}₹ ${body}`;
}

/** Compact Indian notation for chart axes: ₹8.5L, ₹1.2Cr, ₹45K */
export function formatINRCompact(p: Paise) {
  const r = fromPaise(p);
  const abs = Math.abs(r);
  const sign = r < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${abs}`;
}

const trim = (n: number) => (Math.round(n * 10) / 10).toString();

export const formatQty = (n: number, unit?: string) => `${qty.format(n)}${unit ? ` ${unit}` : ""}`;

export const formatPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

const asDate = (d: string | Date) => (typeof d === "string" ? parseISO(d) : d);
export const formatDate = (d: string | Date) => format(asDate(d), "dd MMM yyyy");
export const formatDateShort = (d: string | Date) => format(asDate(d), "dd MMM");
export const formatDayLong = (d: string | Date) => format(asDate(d), "EEE, d MMM yyyy");
