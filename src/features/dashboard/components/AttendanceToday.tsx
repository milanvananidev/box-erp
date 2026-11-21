import { UserCheck, UserX, CalendarOff, Users, UserMinus } from "lucide-react";
import { SectionCard } from "@/components/shared/SectionCard";
import { RingGauge } from "@/components/shared/RingGauge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDashboardSummary } from "../api";

export function AttendanceToday({ className }: { className?: string }) {
  const { data, isLoading } = useDashboardSummary();
  const a = data?.attendance;
  const effective = a ? a.present + a.halfDay * 0.5 : 0;
  const pct = a ? ((a.present + a.halfDay) / Math.max(a.total, 1)) * 100 : 0;

  const rows = a
    ? [
        { icon: UserCheck, label: "Present", value: a.present, color: "text-success" },
        { icon: UserMinus, label: "Half Day", value: a.halfDay, color: "text-warning" },
        { icon: UserX, label: "Absent", value: a.absent, color: "text-danger" },
        { icon: CalendarOff, label: "On Leave", value: a.leave, color: "text-violet" },
        { icon: Users, label: "Total Workers", value: a.total, color: "text-[#475467]", strong: true },
      ]
    : [];

  return (
    <SectionCard className={className} title="Attendance (Today)" viewAllHref="/workers">
      {isLoading || !a ? (
        <div className="flex items-center gap-6">
          <Skeleton className="size-[140px] rounded-full" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5" />)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <RingGauge
            value={pct}
            size={140}
            stroke={14}
            color="var(--success)"
            track="#eef0f3"
            label={formatPercent(pct)}
            sublabel="Attendance"
          />
          <ul className="min-w-0 flex-1 divide-y divide-border">
            {rows.map(({ icon: Icon, label, value, color, strong }) => (
              <li key={label} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <Icon className={cn("size-[18px] shrink-0", color)} strokeWidth={1.75} />
                <span className={cn("flex-1 text-[15px] text-[#344054]", strong && "font-medium text-foreground")}>{label}</span>
                <span className="text-[15px] font-semibold tabular">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {a && (
        <p className="mt-3 text-xs text-muted-foreground tabular">
          Paid man-days today: <span className="font-medium text-foreground">{effective}</span> (half day counts as 0.5)
        </p>
      )}
    </SectionCard>
  );
}
