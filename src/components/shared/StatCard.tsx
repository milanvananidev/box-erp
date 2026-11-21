import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const tones = {
  success: { card: "bg-success-soft/80 border-[#d4eedd]", icon: "bg-[#d3efdd] text-success" },
  danger: { card: "bg-danger-soft/80 border-[#f8d9d9]", icon: "bg-[#fbd9d9] text-danger" },
  info: { card: "bg-info-soft/80 border-[#d6e5fb]", icon: "bg-[#d6e5fb] text-info" },
  violet: { card: "bg-violet-soft/80 border-[#e2dbfa]", icon: "bg-[#e2dbfa] text-violet" },
  brand: { card: "bg-brand-50 border-brand-100", icon: "bg-brand-100 text-brand-600" },
} as const;

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone: keyof typeof tones;
  /** % change; sign decides arrow. `goodWhenUp=false` for costs so a rise shows red. */
  changePct?: number | null;
  goodWhenUp?: boolean;
  comparison?: string;
  footnote?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({
  label, value, icon: Icon, tone, changePct, goodWhenUp = true, comparison, footnote, loading, onClick,
}: StatCardProps) {
  const t = tones[tone];
  const up = (changePct ?? 0) >= 0;
  const good = up === goodWhenUp;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-start gap-3.5 rounded-xl border p-4 text-left transition-shadow 2xl:gap-4 2xl:p-5",
        onClick && "cursor-pointer hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        t.card,
      )}
    >
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full 2xl:size-14", t.icon)}>
        <Icon className="size-6 2xl:size-7" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-[#344054]">{label}</p>
        {loading ? (
          <>
            <Skeleton className="mt-2 h-8 w-36 bg-white/70" />
            <Skeleton className="mt-2 h-4 w-28 bg-white/70" />
          </>
        ) : (
          <>
            <p className="mt-0.5 truncate text-[24px] leading-tight font-bold tracking-tight tabular 2xl:text-[28px]">{value}</p>
            {changePct != null ? (
              <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] 2xl:text-sm">
                <span className={cn("inline-flex items-center gap-1 font-semibold", good ? "text-success-foreground" : "text-danger-foreground")}>
                  {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  {up ? "+" : ""}
                  {changePct.toFixed(1)}%
                </span>
                {comparison && <span className="text-[#475467]">{comparison}</span>}
              </p>
            ) : (
              footnote && <p className="mt-1 text-sm text-[#475467]">{footnote}</p>
            )}
          </>
        )}
      </div>
    </Comp>
  );
}
