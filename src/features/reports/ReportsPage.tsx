import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeftRight, Landmark, Receipt, Wallet, type LucideIcon } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PRESETS, resolveRange, type Preset } from "./range";
import { ProfitReportView } from "./components/ProfitReportView";
import { CashFlowReportView } from "./components/CashFlowReportView";
import { LabourReportView } from "./components/LabourReportView";
import { PayrollReportView } from "./components/PayrollReportView";

type ReportId = "profit" | "cash-flow" | "labour" | "payroll";

const REPORTS: { group: string; items: { id: ReportId; label: string; hint: string; icon: LucideIcon }[] }[] = [
  {
    group: "Finance",
    items: [
      { id: "profit", label: "Income vs Expenses", hint: "Operating profit estimate", icon: ArrowLeftRight },
      { id: "cash-flow", label: "Cash Flow", hint: "All money in and out", icon: Landmark },
    ],
  },
  {
    group: "People",
    items: [
      { id: "labour", label: "Labour Cost", hint: "By month and department", icon: Receipt },
      { id: "payroll", label: "Payroll Register", hint: "Gross, deductions, paid", icon: Wallet },
    ],
  },
];

export default function ReportsPage() {
  usePageMeta("Reports", "Financial and operational summaries");
  const [params, setParams] = useSearchParams();
  const report = (params.get("report") as ReportId | null) ?? "profit";
  const preset = (params.get("preset") as Preset | null) ?? "last_6";
  const thisMonth = format(new Date(), "yyyy-MM");
  const from = params.get("from") ?? thisMonth;
  const to = params.get("to") ?? thisMonth;

  const patch = useCallback(
    (c: Record<string, string | null>) =>
      setParams((prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(c)) v === null ? n.delete(k) : n.set(k, v);
        return n;
      }, { replace: true }),
    [setParams],
  );

  const range = useMemo(() => resolveRange(preset, from, to), [preset, from, to]);

  const View = ({ profit: ProfitReportView, "cash-flow": CashFlowReportView, labour: LabourReportView, payroll: PayrollReportView } as Record<string, typeof ProfitReportView>)[report] ?? ProfitReportView;

  return (
    <div className="grid grid-cols-[232px_1fr] items-start gap-5">
      <aside className="sticky top-0 space-y-4 rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="space-y-2 border-b border-border px-1 pb-4">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="report-period">Period</label>
          <Select value={preset} onValueChange={(v) => patch({ preset: v === "last_6" ? null : v })}>
            <SelectTrigger id="report-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRESETS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              <SelectItem value="custom">Custom months…</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="month" aria-label="From month" value={from} max={thisMonth} onChange={(e) => e.target.value && patch({ from: e.target.value })} className="px-2 text-xs" />
              <Input type="month" aria-label="To month" value={to} min={from} max={thisMonth} onChange={(e) => e.target.value && patch({ to: e.target.value })} className="px-2 text-xs" />
            </div>
          )}
        </div>
        <nav className="space-y-3">
          {REPORTS.map((g) => (
            <div key={g.group}>
              <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.group}</div>
              {g.items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => patch({ report: r.id === "profit" ? null : r.id })}
                  aria-current={report === r.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    report === r.id ? "bg-brand-50 text-brand-800" : "hover:bg-muted",
                  )}
                >
                  <r.icon className={cn("mt-0.5 size-4 shrink-0", report === r.id ? "text-brand-600" : "text-muted-foreground")} />
                  <span>
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <View range={range} />
      </div>
    </div>
  );
}
