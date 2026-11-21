import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMode, PayrollLine } from "@/types/domain";
import { periodLabel, usePaySalaries } from "../api";

/** Records salary payouts: one cash-book entry for the batch, advances recovered oldest-first. */
export function PayDialog({ period, lines, onOpenChange }: { period: string; lines: PayrollLine[] | null; onOpenChange: (v: boolean) => void }) {
  const pay = usePaySalaries();
  const today = format(new Date(), "yyyy-MM-dd");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [paidOn, setPaidOn] = useState(today);
  useEffect(() => {
    if (lines) {
      setPaidOn(today);
      setMode(lines.every((l) => l.wageType === "monthly") ? "bank" : "cash");
    }
  }, [lines, today]);

  if (!lines) return null;
  const total = lines.reduce((s, l) => s + l.net, 0);
  const advance = lines.reduce((s, l) => s + l.advanceDeduction, 0);

  const submit = async () => {
    try {
      const res = await pay.mutateAsync({ period, workerIds: lines.map((l) => l.workerId), mode, paidOn });
      toast.success(`Paid ${res.paid} salar${res.paid > 1 ? "ies" : "y"}: ${formatINR(res.total)}`, { description: "Recorded in the cash book as Wages & Salary." });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't record payment", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Dialog open={!!lines} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {lines.length === 1 ? lines[0]!.name : `${lines.length} workers`}</DialogTitle>
          <DialogDescription>{periodLabel(period)} salary. This records the payout. Hand over the cash or make the transfer separately.</DialogDescription>
        </DialogHeader>
        {lines.length > 1 && (
          <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm tabular">
            {lines.map((l) => (
              <li key={l.workerId} className="flex justify-between px-3 py-1.5"><span>{l.name} <span className="text-muted-foreground">{l.code}</span></span><span className="font-medium">{formatINR(l.net)}</span></li>
            ))}
          </ul>
        )}
        <div className="flex items-end justify-between rounded-xl bg-brand-50 p-4">
          <div>
            <div className="text-xs text-brand-800">Total net pay</div>
            <div className="text-2xl font-bold tabular">{formatINR(total)}</div>
          </div>
          {advance > 0 && <div className="text-right text-xs text-brand-800 tabular">includes {formatINR(advance)}<br />advance recovered</div>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Paid by" required>
            <div className="grid h-9 grid-cols-3 gap-1 rounded-lg border border-input p-0.5">
              {(["cash", "bank", "upi"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={cn("rounded-md text-[13px] font-medium", mode === m ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}>
                  {m === "upi" ? "UPI" : m[0]!.toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Payment date" htmlFor="pay-date" required>
            <Input id="pay-date" type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pay.isPending} disabled={!paidOn} onClick={submit}>Record payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
