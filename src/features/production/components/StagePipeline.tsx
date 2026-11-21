import { STAGE_LABEL } from "@/lib/production";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductionOrder, ProductionStage } from "@/types/domain";

const PIPE: ProductionStage[] = ["planned", "corrugation", "printing", "cutting", "pasting", "bundling", "on_hold"];

/** Shop-floor snapshot: how many active orders sit at each stage. Click to filter. */
export function StagePipeline({
  orders,
  value,
  onChange,
}: {
  orders: ProductionOrder[] | undefined;
  value: ProductionStage | null;
  onChange: (s: ProductionStage | null) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-2.5">
      {PIPE.map((stage) => {
        const list = orders?.filter((o) => o.stage === stage) ?? [];
        const pending = list.reduce((s, o) => s + Math.max(0, o.plannedQty - o.producedQty), 0);
        const active = value === stage;
        const hold = stage === "on_hold";
        return (
          <button
            key={stage}
            onClick={() => onChange(active ? null : stage)}
            aria-pressed={active}
            className={cn(
              "group relative rounded-xl border bg-card px-3.5 py-3 text-left shadow-card transition-all hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? (hold ? "border-danger ring-2 ring-danger-soft" : "border-brand-400 ring-2 ring-brand-100") : "border-border",
            )}
          >
            <div className={cn("truncate text-[13px] font-medium", hold ? "text-danger-foreground" : "text-[#475467]")}>{STAGE_LABEL[stage]}</div>
            {orders ? (
              <>
                <div className="mt-0.5 text-2xl font-bold tabular">{list.length}</div>
                <div className="truncate text-xs text-muted-foreground tabular">{list.length ? `${formatQty(pending)} pcs to go` : "—"}</div>
              </>
            ) : (
              <Skeleton className="mt-1.5 h-10 w-16" />
            )}
          </button>
        );
      })}
    </div>
  );
}
