import { useNavigate } from "react-router-dom";
import { Users, HandCoins, Play, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useWorkerRoster } from "@/features/workers/api";
import { useDashboardSummary } from "../api";
import { cn } from "@/lib/utils";

export function WorkerOverviewCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { data: roster = [] } = useWorkerRoster();
  const { data: summary } = useDashboardSummary();

  const activeWorkers = roster.filter((w) => w.active).length;
  const advancesDue = roster.reduce((sum, w) => sum + (w.advanceBalance || 0), 0);
  const salaryEst = summary?.salaryPending.amount ?? 0;

  return (
    <div className={cn("flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-2xs select-none", className)}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Users className="size-3.5 text-[#C98F4F]" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-foreground tracking-tight">Worker & HR Overview</h3>
              <p className="text-[11px] text-muted-foreground">Attendance & payroll health</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/workers")}
            className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
          >
            Roster <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Metrics List */}
        <div className="divide-y divide-border/60 py-1.5">
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground text-[11px]">Active workers on roster</span>
            <span className="font-semibold text-foreground text-xs font-mono">{activeWorkers}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground text-[11px]">Advances outstanding</span>
            <span className="font-semibold text-foreground text-xs font-mono">{formatINR(advancesDue)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground text-[11px]">Est. monthly wages</span>
            <span className="font-semibold text-foreground text-xs font-mono">{formatINR(salaryEst)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-border/60">
        <button
          onClick={() => navigate("/workers?tab=advances")}
          className="flex h-7 items-center justify-center gap-1.5 rounded border border-border bg-subtle hover:bg-muted text-[11px] font-semibold text-foreground/80 transition-colors cursor-pointer shadow-2xs"
        >
          <HandCoins className="size-3 text-muted-foreground" /> Give Advance
        </button>
        <button
          onClick={() => navigate("/payroll")}
          className="flex h-7 items-center justify-center gap-1.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Play className="size-3" /> Run Payroll
        </button>
      </div>
    </div>
  );
}
