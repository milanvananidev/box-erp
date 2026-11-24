import { useNavigate } from "react-router-dom";
import { Users, HandCoins, CalendarCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { useWorkerRoster } from "@/features/workers/api";
import { useDashboardSummary } from "../api";

export function WorkerOverviewCard() {
  const navigate = useNavigate();
  const { data: roster = [] } = useWorkerRoster();
  const { data: summary } = useDashboardSummary();

  const activeWorkers = roster.filter((w) => w.active).length;
  const advancesDue = roster.reduce((sum, w) => sum + (w.advanceBalance || 0), 0);
  const att = summary?.attendance;
  const presentCount = att ? att.present + att.halfDay : 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Users className="size-4 text-[#C98F4F]" />
            </span>
            <h3 className="text-base font-bold text-foreground">Worker & HR</h3>
          </div>
          <button
            onClick={() => navigate("/workers")}
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
          >
            Roster <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Metrics List */}
        <div className="divide-y divide-border/60 py-2">
          <div className="flex items-center justify-between py-2.5 text-xs">
            <span className="text-muted-foreground">Today's attendance</span>
            <span className="font-semibold text-foreground text-sm font-mono">
              {att ? `${presentCount} / ${att.total} present` : `${activeWorkers} active`}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-xs">
            <span className="text-muted-foreground">Advances due</span>
            <span className="font-semibold text-foreground text-sm font-mono">{formatINR(advancesDue)}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 text-xs">
            <span className="text-muted-foreground">Salary this month (est.)</span>
            <span className="font-semibold text-foreground text-sm font-mono">{formatINR(summary?.salaryPending.amount ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/workers?tab=attendance")}
          className="text-xs h-8 text-[#344054] font-medium border-border hover:bg-subtle"
        >
          <CalendarCheck className="size-3.5 text-brand-600" /> Attendance
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/workers?tab=advances")}
          className="text-xs h-8 text-[#344054] font-medium border-border hover:bg-subtle"
        >
          <HandCoins className="size-3.5 text-brand-600" /> Give Advance
        </Button>
      </div>
    </div>
  );
}
