import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/shared/SectionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatINR } from "@/lib/format";
import { initials } from "@/lib/utils";
import { useDashboardSummary, usePendingSalaries } from "../api";

export function SalaryPending({ className }: { className?: string }) {
  const { data: s, isLoading } = useDashboardSummary();
  const { data: list } = usePendingSalaries();
  const sp = s?.salaryPending;

  return (
    <SectionCard className={className} title="Salary Pending" viewAllHref="/payroll">
      {isLoading || !sp ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
            <div className="flex items-center gap-2 text-[13px] text-brand-800">
              <Wallet className="size-4" /> Accrued this month · {sp.workers} workers
            </div>
            <div className="mt-1 text-[26px] leading-tight font-bold tracking-tight tabular">{formatINR(sp.amount)}</div>
            <div className="mt-1 flex justify-between text-xs text-brand-800/80 tabular">
              <span>Due {formatDate(sp.dueOn)}</span>
              <span>Advances to recover {formatINR(sp.advancesOutstanding)}</span>
            </div>
          </div>
          {sp.unpaid.workers > 0 && (
            <Link to="/payroll?tab=pending" className="-mt-1 flex items-center justify-between rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-foreground hover:bg-[#fbdcdc]">
              <span>Unpaid from earlier months · {sp.unpaid.workers} workers</span>
              <b className="tabular">{formatINR(sp.unpaid.amount)}</b>
            </Link>
          )}
          <ul className="space-y-2.5">
            {(list ?? []).slice(0, 3).map((p) => (
              <li key={p.workerId} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-[#475467]">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.department}</span>
                </span>
                <span className="text-sm font-semibold tabular">{formatINR(p.netPayable)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
