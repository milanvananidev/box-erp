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

  const surplusMarginPct = cashInVal > 0 ? ((surplusVal / cashInVal) * 100).toFixed(1) : "0.0";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 select-none">
      {/* 1. Cash In */}
      <div
        onClick={() => navigate("/finance?direction=in")}
        className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cash In</span>
            <div className="text-xl font-bold tracking-tight text-foreground font-mono">
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
              className="flex h-6 items-center gap-0.5 rounded border border-emerald-300/80 bg-emerald-50 px-1.5 text-[10px] font-bold text-emerald-800 transition-colors hover:bg-emerald-600 hover:text-white cursor-pointer shadow-2xs"
            >
              <Plus className="size-2.5" /> Income
            </button>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="size-3.5" />
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-emerald-600 flex items-center gap-1">
            ↗ +12.5% <span className="font-normal text-muted-foreground">vs last mo</span>
          </span>
          <svg className="h-4 w-12 text-emerald-500 overflow-visible" viewBox="0 0 64 24" fill="none">
            <path d="M2 20 C 14 18, 24 14, 34 16 C 44 18, 52 8, 62 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* 2. Cash Out */}
      <div
        onClick={() => navigate("/finance?direction=out")}
        className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cash Out</span>
            <div className="text-xl font-bold tracking-tight text-foreground font-mono">
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
              className="flex h-6 items-center gap-0.5 rounded border border-rose-300/80 bg-rose-50 px-1.5 text-[10px] font-bold text-rose-800 transition-colors hover:bg-rose-600 hover:text-white cursor-pointer shadow-2xs"
            >
              <Plus className="size-2.5" /> Expense
            </button>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
              <ArrowUpRight className="size-3.5" />
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-rose-600 flex items-center gap-1">
            ↗ +8.3% <span className="font-normal text-muted-foreground">vs last mo</span>
          </span>
          <svg className="h-4 w-12 text-rose-500 overflow-visible" viewBox="0 0 64 24" fill="none">
            <path d="M2 18 C 14 19, 24 12, 34 15 C 44 18, 52 10, 62 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* 3. Operating Surplus */}
      <div
        onClick={() => navigate("/reports")}
        className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Operating Surplus</span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                {surplusMarginPct}%
              </span>
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground font-mono">
              {isLoading ? "—" : formatINR(surplusVal)}
            </div>
          </div>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <TrendingUp className="size-3.5" />
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-emerald-600 flex items-center gap-1">
            ↗ +21.1% <span className="font-normal text-muted-foreground">vs last mo</span>
          </span>
        </div>
      </div>

      {/* 4. Active Workers */}
      <div
        onClick={() => navigate("/workers")}
        className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active Workers</span>
            <div className="text-xl font-bold tracking-tight text-foreground font-mono">
              {isLoading ? "—" : workerCount}
            </div>
          </div>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <Users className="size-3.5" />
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Active on factory payroll</span>
        </div>
      </div>
    </div>
  );
}
