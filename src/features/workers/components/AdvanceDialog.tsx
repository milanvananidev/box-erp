import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { formatINR, toPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGiveAdvance, useWorkerRoster } from "../api";

const schema = z.object({
  workerId: z.string({ error: "Choose a worker" }).min(1, "Choose a worker"),
  amount: z.number({ error: "Enter the amount" }).positive("Must be more than zero").max(200000, "That's unusually large. Check the amount."),
  date: z.string().min(1),
  mode: z.enum(["cash", "bank", "upi"]),
  note: z.string().trim().max(120).optional(),
});
type Values = z.infer<typeof schema>;

export function AdvanceDialog({ open, onOpenChange, workerId }: { open: boolean; onOpenChange: (v: boolean) => void; workerId?: string }) {
  const give = useGiveAdvance();
  const { data: roster = [] } = useWorkerRoster();
  const active = roster.filter((w) => w.active).sort((a, b) => a.name.localeCompare(b.name));
  const today = format(new Date(), "yyyy-MM-dd");

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { workerId: workerId ?? "", date: today, mode: "cash", note: "" },
  });
  useEffect(() => {
    if (open) reset({ workerId: workerId ?? "", date: today, mode: "cash", note: "", amount: undefined as unknown as number });
  }, [open, workerId, reset, today]);

  const selected = roster.find((w) => w.id === watch("workerId"));

  const onSubmit = handleSubmit(async (v) => {
    try {
      await give.mutateAsync({ workerId: v.workerId, amount: toPaise(v.amount), date: v.date, mode: v.mode, note: v.note || undefined });
      toast.success(`Advance of ${formatINR(toPaise(v.amount))} recorded`, { description: "Added to the cash book and will be deducted from salary." });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't record advance", { description: e instanceof Error ? e.message : undefined });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give salary advance</DialogTitle>
          <DialogDescription>Recorded as cash out, not an expense, and recovered from upcoming salary.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Worker" error={errors.workerId?.message} required>
            <Controller control={control} name="workerId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!!workerId}>
                <SelectTrigger aria-invalid={!!errors.workerId}><SelectValue placeholder="Select worker" /></SelectTrigger>
                <SelectContent>{active.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · {w.code}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </FormField>
          {selected && selected.advanceBalance > 0 && (
            <p className="-mt-2 text-xs text-warning-foreground">Already outstanding: {formatINR(selected.advanceBalance)}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Amount (₹)" htmlFor="adv-amt" error={errors.amount?.message} required>
              <Input id="adv-amt" type="number" min="0" step="1" autoFocus className="font-semibold" aria-invalid={!!errors.amount}
                {...register("amount", { setValueAs: (x: string) => (x === "" ? undefined : Number(x)) })} />
            </FormField>
            <FormField label="Date" htmlFor="adv-date" required>
              <Input id="adv-date" type="date" max={today} {...register("date")} />
            </FormField>
          </div>
          <FormField label="Paid by" required>
            <Controller control={control} name="mode" render={({ field }) => (
              <div className="grid h-9 grid-cols-3 gap-1 rounded-lg border border-input p-0.5">
                {(["cash", "bank", "upi"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => field.onChange(m)}
                    className={cn("rounded-md text-[13px] font-medium", field.value === m ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}>
                    {m === "upi" ? "UPI" : m[0]!.toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            )} />
          </FormField>
          <FormField label="Note" htmlFor="adv-note">
            <Input id="adv-note" placeholder="Reason (optional)" {...register("note")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={give.isPending}>Record advance</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
