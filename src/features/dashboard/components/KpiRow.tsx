import { ArrowDownLeft, ArrowUpRight, TrendingUp, Users, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatINR } from "@/lib/format";
import { useUI } from "@/stores/ui";
import { useDashboardSummary } from "../api";

export function KpiRow() {
  const { data, isLoading } = useDashboardSummary();
  const navigate = useNavigate();
  const openTxnSheet = useUI((s) => s.openTxnSheet);

  const cashInVal = data?.cashIn.value ?? 0;
  const cashOutVal = data?.cashOut.value ?? 0;
  const surplusVal = data?.operatingProfit.value ?? 0;
  const workerCount = data?.attendance.total ?? 0;

  // Operating surplus margin percentage
  const surplusMarginPct = cashInVal > 0 ? ((surplusVal / cashInVal) * 100).toFixed(1) : "0.0";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. Cash In */}
      <div
        onClick={() => navigate("/finance?direction=in")}
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:shadow-card hover:border-brand-200 cursor-pointer overflow-hidden"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Cash In</span>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {isLoading ? "—" : formatINR(cashInVal)}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openTxnSheet("in");
              }}
              title="Add Income (⌘+Shift+I)"
              className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="size-3" /> Income
            </button>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
              <ArrowDownLeft className="size-5" />
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            ↗ +12.5% <span className="font-normal text-muted-foreground">vs last month</span>
          </span>
          {/* Mini Sparkline SVG */}
          <svg className="h-6 w-16 text-emerald-500 overflow-visible" viewBox="0 0 64 24" fill="none">
            <path
              d="M2 20 C 14 18, 24 14, 34 16 C 44 18, 52 8, 62 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* 2. Cash Out */}
      <div
        onClick={() => navigate("/finance?direction=out")}
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:shadow-card hover:border-brand-200 cursor-pointer overflow-hidden"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Cash Out</span>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {isLoading ? "—" : formatINR(cashOutVal)}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openTxnSheet("out");
              }}
              title="Add Expense (⌘+Shift+E)"
              className="flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="size-3" /> Expense
            </button>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-4 ring-rose-50/50">
              <ArrowUpRight className="size-5" />
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
            ↗ +8.3% <span className="font-normal text-muted-foreground">vs last month</span>
          </span>
          {/* Mini Sparkline SVG */}
          <svg className="h-6 w-16 text-rose-500 overflow-visible" viewBox="0 0 64 24" fill="none">
            <path
              d="M2 18 C 14 19, 24 12, 34 15 C 44 18, 52 10, 62 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* 3. Operating Surplus */}
      <div
        onClick={() => navigate("/reports")}
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:shadow-card hover:border-brand-200 cursor-pointer overflow-hidden"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Operating Surplus</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                {surplusMarginPct}%
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {isLoading ? "—" : formatINR(surplusVal)}
            </div>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-4 ring-amber-50/50">
            <TrendingUp className="size-5" />
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            ↗ +21.1% <span className="font-normal text-muted-foreground">vs last month</span>
          </span>
        </div>
      </div>

      {/* 4. Active Workers */}
      <div
        onClick={() => navigate("/workers")}
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:shadow-card hover:border-brand-200 cursor-pointer overflow-hidden"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Active Workers</span>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {isLoading ? "—" : workerCount}
            </div>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-4 ring-violet-50/50">
            <Users className="size-5" />
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>On payroll</span>
        </div>
      </div>
    </div>
  );
}
