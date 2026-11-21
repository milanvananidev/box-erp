import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "../api";

export function StockStatusBadge({ status }: { status: StockStatus }) {
  if (status === "out") return <Badge tone="danger" dot>Out of stock</Badge>;
  if (status === "low") return <Badge tone="warning" dot>Low stock</Badge>;
  return <Badge tone="success" dot>In stock</Badge>;
}
