import { Check } from "lucide-react";
import { STAGE_LABEL, stagesFor, workingStage } from "@/lib/production";
import { cn } from "@/lib/utils";
import type { ProductionOrder } from "@/types/domain";

/** Horizontal shop-floor progress for one order. Plain boxes skip Printing. */
export function StageStepper({ order }: { order: ProductionOrder }) {
  const flow = stagesFor(order.spec);
  const current = flow.indexOf(workingStage(order));
  const held = order.stage === "on_hold";
  return (
    <ol className="flex items-start" aria-label="Production stages">
      {flow.map((s, i) => {
        const done = i < current || order.stage === "completed";
        const active = i === current && order.stage !== "completed";
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span className={cn("absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2", i <= current || order.stage === "completed" ? "bg-brand-400" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done && "border-brand-500 bg-brand-500 text-white",
                active && !held && "border-brand-500 bg-card text-brand-600 ring-4 ring-brand-100",
                active && held && "border-danger bg-card text-danger ring-4 ring-danger-soft",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("mt-2 px-1 text-[12px] leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {STAGE_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
