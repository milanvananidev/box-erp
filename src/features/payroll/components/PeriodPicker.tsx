import { CheckCircle2, CircleDashed, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { periodShort, usePayrollPeriods } from "../api";

/** Last four months as selectable cards with run status and payout progress. */
export function PeriodPicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  const { data } = usePayrollPeriods();
  if (!data) return <div className="grid grid-cols-4 gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-xl" />)}</div>;
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {[...data].reverse().map((p) => {
        const active = p.period === value;
        const allPaid = p.status === "finalized" && p.paidCount === p.workers;
        const Icon = p.inProgress ? Clock : p.status === "finalized" ? CheckCircle2 : CircleDashed;
        return (
          <button
            key={p.period}
            onClick={() => onChange(p.period)}
            aria-pressed={active}
            className={cn(
              "rounded-xl border bg-card px-3.5 py-2.5 text-left shadow-card transition-all hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "border-brand-400 ring-2 ring-brand-100" : "border-border",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{periodShort(p.period)}</span>
              <Icon className={cn("size-4", p.inProgress ? "text-info" : p.status === "finalized" ? (allPaid ? "text-success" : "text-warning") : "text-muted-foreground")} />
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular">
              {p.inProgress ? "In progress" : p.status === "draft" ? "Not finalised" : allPaid ? "All paid" : `${p.paidCount}/${p.workers} paid`}
              {" · "}{formatINRCompact(p.net)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
