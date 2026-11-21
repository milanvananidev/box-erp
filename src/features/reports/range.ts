import { eachMonthOfInterval, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";

export type Preset = "this_month" | "last_month" | "last_3" | "last_6" | "fy" | "custom";

export const PRESETS: Record<Exclude<Preset, "custom">, string> = {
  this_month: "This month",
  last_month: "Last month",
  last_3: "Last 3 months",
  last_6: "Last 6 months",
  fy: "This financial year",
};

export interface ReportRange {
  /** inclusive, yyyy-MM-dd (capped at today) */
  from: string;
  to: string;
  /** yyyy-MM periods covered */
  months: string[];
  label: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Indian financial year starts 1 April. */
function fyStart(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(y, 3, 1);
}

export function resolveRange(preset: Preset, customFrom?: string, customTo?: string): ReportRange {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  switch (preset) {
    case "this_month": start = startOfMonth(now); break;
    case "last_month": start = startOfMonth(subMonths(now, 1)); end = endOfMonth(start); break;
    case "last_3": start = startOfMonth(subMonths(now, 2)); break;
    case "last_6": start = startOfMonth(subMonths(now, 5)); break;
    case "fy": start = fyStart(now); break;
    case "custom": {
      const f = customFrom ?? format(now, "yyyy-MM");
      const t = customTo && customTo >= f ? customTo : f;
      start = parseISO(`${f}-01`);
      end = endOfMonth(parseISO(`${t}-01`));
      if (end > now) end = now;
    }
  }
  const months = eachMonthOfInterval({ start, end }).map((m) => format(m, "yyyy-MM"));
  const label =
    months.length === 1 ? format(start, "MMMM yyyy") : `${format(start, "MMM yyyy")} – ${format(end, "MMM yyyy")}`;
  return { from: iso(start), to: iso(end), months, label: preset === "fy" ? `FY ${format(start, "yyyy")}-${format(end, "yy")} (to date)` : label };
}

export const monthLabel = (m: string) => format(parseISO(`${m}-01`), "MMM yy");
