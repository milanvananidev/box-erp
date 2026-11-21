import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  FileSpreadsheet,
  Landmark,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PRESETS, resolveRange, type Preset } from "./range";
import { MonthlyStatementView } from "./components/MonthlyStatementView";
import { ProfitReportView } from "./components/ProfitReportView";
import { CashFlowReportView } from "./components/CashFlowReportView";
import { LabourReportView } from "./components/LabourReportView";
import { PayrollReportView } from "./components/PayrollReportView";

type ReportId = "monthly" | "profit" | "cash-flow" | "labour" | "payroll";

const REPORTS: { group: string; items: { id: ReportId; label: string; hint: string; icon: LucideIcon }[] }[] = [
  {
    group: "Monthly Statement",
    items: [
      {
        id: "monthly",
        label: "Monthly Factory Statement",
        hint: "Overall P&L, Outflows & Net Profit",
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    group: "Trends & Cash",
    items: [
      { id: "profit", label: "Income vs Expenses", hint: "6-Month Profit Trend", icon: ArrowLeftRight },
      { id: "cash-flow", label: "Cash Flow", hint: "All cash, bank and modes", icon: Landmark },
    ],
  },
  {
    group: "Labour & Wages",
    items: [
      { id: "labour", label: "Labour Cost", hint: "By month and department", icon: Receipt },
      { id: "payroll", label: "Payroll Register", hint: "Gross, deductions, paid", icon: Wallet },
    ],
  },
];

export default function ReportsPage() {
  usePageMeta("Reports", "Monthly overall statement and financial summaries");
  const [params, setParams] = useSearchParams();
  const report = (params.get("report") as ReportId | null) ?? "monthly";
  const preset = (params.get("preset") as Preset | null) ?? "last_6";
  const thisMonth = format(new Date(), "yyyy-MM");
  const from = params.get("from") ?? thisMonth;
  const to = params.get("to") ?? thisMonth;

  const patch = useCallback(
    (c: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(c)) v === null ? n.delete(k) : n.set(k, v);
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );

  const range = useMemo(() => resolveRange(preset, from, to), [preset, from, to]);

  const renderView = () => {
    switch (report) {
      case "monthly":
        return <MonthlyStatementView />;
      case "cash-flow":
        return <CashFlowReportView range={range} />;
      case "labour":
        return <LabourReportView range={range} />;
      case "payroll":
        return <PayrollReportView range={range} />;
      case "profit":
      default:
        return <ProfitReportView range={range} />;
    }
  };

  return (
    <div className="grid grid-cols-[250px_1fr] items-start gap-5">
      <aside className="sticky top-0 space-y-4 rounded-2xl border border-border bg-card p-3.5 shadow-card">
        {/* Period Picker only for multi-month trend reports */}
        {report !== "monthly" && (
          <div className="space-y-2 border-b border-border px-1 pb-4">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="report-period">
              Trend Period
            </label>
            <Select value={preset} onValueChange={(v) => patch({ preset: v === "last_6" ? null : v })}>
              <SelectTrigger id="report-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESETS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom months…</SelectItem>
              </SelectContent>
            </Select>
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="month"
                  aria-label="From month"
                  value={from}
                  max={thisMonth}
                  onChange={(e) => e.target.value && patch({ from: e.target.value })}
                  className="px-2 text-xs"
                />
                <Input
                  type="month"
                  aria-label="To month"
                  value={to}
                  min={from}
                  max={thisMonth}
                  onChange={(e) => e.target.value && patch({ to: e.target.value })}
                  className="px-2 text-xs"
                />
              </div>
            )}
          </div>
        )}

        <nav className="space-y-3.5">
          {REPORTS.map((g) => (
            <div key={g.group}>
              <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {g.group}
              </div>
              <div className="space-y-1">
                {g.items.map((r) => {
                  const isActive = report === r.id;
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onClick={() => patch({ report: r.id === "monthly" ? null : r.id })}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer",
                        isActive
                          ? "bg-brand-50 text-brand-900 border border-brand-200/80 shadow-2xs font-semibold"
                          : "text-muted-foreground hover:bg-subtle hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          isActive ? "text-brand-600" : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight text-foreground">{r.label}</span>
                        <span className="block text-xs text-muted-foreground truncate">{r.hint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">{renderView()}</div>
    </div>
  );
}
