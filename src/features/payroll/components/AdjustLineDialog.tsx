import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { formatINR, fromPaise, toPaise } from "@/lib/format";
import type { PayrollLine } from "@/types/domain";
import { useAdjustLine } from "../api";

const parse = (s: string) => (s.trim() === "" ? 0 : Number(s));

/** Bonus, other deductions and advance recovery for one worker in a draft run. */
export function AdjustLineDialog({ period, line, onOpenChange }: { period: string; line: PayrollLine | null; onOpenChange: (v: boolean) => void }) {
  const adjust = useAdjustLine();
  const [bonus, setBonus] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [advance, setAdvance] = useState("");

  useEffect(() => {
    if (!line) return;
    setBonus(line.bonus ? String(fromPaise(line.bonus)) : "");
    setOther(line.otherDeduction ? String(fromPaise(line.otherDeduction)) : "");
    setNote(line.otherDeductionNote ?? "");
    setAdvance(String(fromPaise(line.advanceDeduction)));
  }, [line]);

  if (!line) return null;
  const b = toPaise(parse(bonus));
  const o = toPaise(parse(other));
  const gross = line.basic + line.overtime + b;
  const maxAdv = Math.max(0, Math.min(line.advanceOutstanding, gross - o));
  const adv = Math.min(toPaise(parse(advance)), maxAdv);
  const net = gross - o - adv;
  const invalid = [bonus, other, advance].some((v) => Number.isNaN(parse(v)) || parse(v) < 0) || net < 0 || (o > 0 && !note.trim());

  const save = async () => {
    try {
      await adjust.mutateAsync({ period, workerId: line.workerId, adjustment: { bonus: b, otherDeduction: o, otherDeductionNote: note.trim() || undefined, advanceDeduction: adv } });
      toast.success(`Updated ${line.name}`, { description: `Net pay ${formatINR(net)}` });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't update", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Dialog open={!!line} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adjust pay: {line.name}</DialogTitle>
          <DialogDescription>{line.code} · {line.designation}. Attendance-based pay can't be edited here. Correct attendance instead.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Bonus / incentive (₹)" htmlFor="adj-bonus">
            <Input id="adj-bonus" type="number" min="0" value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
          </FormField>
          <FormField label="Other deduction (₹)" htmlFor="adj-other" hint="Canteen, damage, loan EMI…">
            <Input id="adj-other" type="number" min="0" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0" />
          </FormField>
          {o > 0 && (
            <FormField label="Deduction reason" htmlFor="adj-note" required className="col-span-2" error={!note.trim() ? "Required when deducting" : undefined}>
              <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          )}
          <FormField
            label="Advance recovery (₹)" htmlFor="adj-adv" className="col-span-2"
            hint={line.advanceOutstanding ? `Outstanding ${formatINR(line.advanceOutstanding)} · max this month ${formatINR(maxAdv)}. Anything not recovered carries forward.` : "No advance outstanding"}
          >
            <div className="flex gap-2">
              <Input id="adj-adv" type="number" min="0" disabled={!line.advanceOutstanding} value={advance} onChange={(e) => setAdvance(e.target.value)} className="max-w-40" />
              <Button type="button" variant="outline" size="sm" className="h-9" disabled={!line.advanceOutstanding} onClick={() => setAdvance(String(fromPaise(maxAdv)))}>Recover max</Button>
              <Button type="button" variant="outline" size="sm" className="h-9" disabled={!line.advanceOutstanding} onClick={() => setAdvance("0")}>Skip this month</Button>
            </div>
          </FormField>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-subtle p-4 text-sm tabular">
          <dt className="text-muted-foreground">Basic ({line.paidDays} paid days{line.pieces ? `, ${line.pieces.toLocaleString("en-IN")} pcs` : ""})</dt><dd className="text-right">{formatINR(line.basic)}</dd>
          <dt className="text-muted-foreground">Overtime ({line.overtimeHours} h)</dt><dd className="text-right">{formatINR(line.overtime)}</dd>
          <dt className="text-muted-foreground">Bonus</dt><dd className="text-right">{formatINR(b)}</dd>
          <dt className="font-medium">Gross</dt><dd className="text-right font-medium">{formatINR(gross)}</dd>
          <dt className="text-muted-foreground">Less advance</dt><dd className="text-right">− {formatINR(adv)}</dd>
          <dt className="text-muted-foreground">Less other</dt><dd className="text-right">− {formatINR(o)}</dd>
          <dt className="border-t border-border pt-1.5 font-semibold">Net pay</dt>
          <dd className={`border-t border-border pt-1.5 text-right text-base font-semibold ${net < 0 ? "text-danger-foreground" : ""}`}>{formatINR(net)}</dd>
        </dl>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={invalid} loading={adjust.isPending} onClick={save}>Save adjustment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
