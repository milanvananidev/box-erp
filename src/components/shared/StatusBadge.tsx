import { Badge, type BadgeProps } from "@/components/ui/badge";
import { STAGE_LABEL } from "@/lib/production";
import type { ProductionStage } from "@/types/domain";

export const STAGE_TONE: Record<ProductionStage, NonNullable<BadgeProps["tone"]>> = {
  planned: "neutral",
  corrugation: "brand",
  printing: "info",
  cutting: "warning",
  pasting: "violet",
  bundling: "info",
  completed: "success",
  on_hold: "danger",
};

export function StageBadge({ stage }: { stage: ProductionStage }) {
  return (
    <Badge tone={STAGE_TONE[stage]} size="md" dot>
      {STAGE_LABEL[stage]}
    </Badge>
  );
}
