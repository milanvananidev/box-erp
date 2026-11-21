import { Badge } from "@/components/ui/badge";
import type { StockMovement } from "@/types/domain";
import { ADJUST_REASONS } from "../api";

export function MovementBadge({ type }: { type: StockMovement["type"] }) {
  switch (type) {
    case "inward": return <Badge tone="success">Inward</Badge>;
    case "issue": return <Badge tone="brand">Issue</Badge>;
    case "adjustment": return <Badge tone="warning">Adjustment</Badge>;
    default: return <Badge tone="neutral">Opening</Badge>;
  }
}

/** One-line description of where stock came from or went. */
export function movementDetail(m: StockMovement) {
  switch (m.type) {
    case "inward": return [m.vendorName, m.billNo && `Bill ${m.billNo}`, m.reels && `${m.reels} reels`, m.transactionId && "paid"].filter(Boolean).join(" · ") || "—";
    case "issue": return m.orderNo ? `${m.orderNo}${m.note ? ` · ${m.note}` : ""}` : (m.note ?? "General use");
    case "adjustment": return [m.reason && ADJUST_REASONS[m.reason], m.note].filter(Boolean).join(" · ");
    default: return m.note ?? "Opening balance";
  }
}
