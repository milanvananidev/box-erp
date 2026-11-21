import { ClipboardList, Cog, Clock, Recycle } from "lucide-react";
import { SectionCard } from "@/components/shared/SectionCard";
import { RingGauge } from "@/components/shared/RingGauge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatQty } from "@/lib/format";
import { useDashboardSummary } from "../api";

export function ProductionOverview({ className }: { className?: string }) {
  const { data, isLoading } = useDashboardSummary();
  const p = data?.production;
  const pct = p ? (p.produced / Math.max(p.planned, 1)) * 100 : 0;
  const rows = p
    ? [
        { icon: ClipboardList, label: "Planned", value: p.planned },
        { icon: Cog, label: "Produced", value: p.produced },
        { icon: Clock, label: "Pending", value: Math.max(p.planned - p.produced, 0) },
        { icon: Recycle, label: "Wastage", value: p.wastage, note: formatPercent((p.wastage / Math.max(p.produced, 1)) * 100) },
      ]
    : [];

  return (
    <SectionCard className={className} title="Production Overview" description="This Month" viewAllHref="/production">
      {isLoading || !p ? (
        <div className="flex items-center gap-6">
          <Skeleton className="size-[150px] rounded-full" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <RingGauge value={pct} size={150} stroke={16} label={`${Math.round(pct)}%`} sublabel="Completion" />
          <ul className="min-w-0 flex-1 divide-y divide-border">
            {rows.map(({ icon: Icon, label, value, note }) => (
              <li key={label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Icon className="size-[18px] shrink-0 text-brand-500" strokeWidth={1.75} />
                <span className="flex-1 text-[15px] text-[#344054]">{label}</span>
                <span className="text-[15px] font-semibold tabular">
                  {formatQty(value)} <span className="font-normal text-muted-foreground">pcs</span>
                  {note && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({note})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
