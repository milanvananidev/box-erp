import { ArrowDownLeft, ArrowUpRight, FileInput, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import type { Direction, PaymentMode, Transaction, TxnSource } from "@/types/domain";

export function DirectionBadge({ direction }: { direction: Direction }) {
  return direction === "in" ? (
    <Badge tone="success" size="md">Income</Badge>
  ) : (
    <Badge tone="danger" size="md">Expense</Badge>
  );
}

export function DirectionIcon({ direction }: { direction: Direction }) {
  return direction === "in" ? (
    <span className="flex size-7 items-center justify-center rounded-full bg-success-soft text-success"><ArrowDownLeft className="size-4" /></span>
  ) : (
    <span className="flex size-7 items-center justify-center rounded-full bg-danger-soft text-danger"><ArrowUpRight className="size-4" /></span>
  );
}

export const modeLabel: Record<PaymentMode, string> = { cash: "Cash", bank: "Bank", upi: "UPI" };

export function ModeBadge({ mode }: { mode: PaymentMode }) {
  return <Badge tone="outline">{modeLabel[mode]}</Badge>;
}

export function SourceTag({ source }: { source: TxnSource }) {
  if (source !== "vyapar_import") return null;
  return (
    <Hint label="Imported from Vyapar — edit in Vyapar, then re-import">
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info-foreground">
        <FileInput className="size-3" /> Vyapar
      </span>
    </Hint>
  );
}

const ORIGIN_LABEL = { advance: "Advance", payroll: "Payroll", inventory: "Inventory" } as const;

/** Entries created by another module; edited from there, not here. */
export function OriginTag({ origin }: { origin?: Transaction["origin"] }) {
  if (!origin) return null;
  return (
    <Hint label={`Created by ${ORIGIN_LABEL[origin.module]}. Change it there.`}>
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-[#475467]">
        <Link2 className="size-3" /> {ORIGIN_LABEL[origin.module]}
      </span>
    </Hint>
  );
}
