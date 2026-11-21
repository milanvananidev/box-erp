import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { FormField } from "@/components/shared/FormField";
import { modKeyLabel, useHotkeys } from "@/hooks/use-hotkeys";
import { fromPaise, toPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Worker } from "@/types/domain";
import { DEPARTMENTS, WAGE_TYPE_LABEL, WAGE_UNIT, useCreateWorker, useUpdateWorker, useWorkerRoster, type WorkerInput } from "../api";

const phone = z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a 10-digit mobile number").optional().or(z.literal(""));

const schema = z.object({
  name: z.string().trim().min(2, "Enter the worker's name").max(80),
  phone,
  address: z.string().trim().max(200).optional(),
  emergencyContact: z.string().trim().max(80).optional(),
  department: z.enum(["Corrugation", "Printing", "Die Cutting", "Pasting", "Stitching", "Dispatch", "Maintenance", "Office"], { error: "Choose a department" }),
  designation: z.string().trim().min(2, "Enter the role").max(60),
  joinedOn: z.string().min(1, "Required"),
  wageType: z.enum(["daily", "monthly", "piece_rate"]),
  wageRate: z.number({ error: "Enter the wage" }).positive("Must be more than zero").max(500000),
  overtimeRate: z.number({ error: "Enter OT rate (0 if none)" }).min(0).max(5000),
  notes: z.string().trim().max(500).optional(),
});
type Values = z.infer<typeof schema>;

const defaults = (w?: Worker): Values =>
  w
    ? {
        name: w.name, phone: w.phone ?? "", address: w.address ?? "", emergencyContact: w.emergencyContact ?? "",
        department: w.department, designation: w.designation, joinedOn: w.joinedOn, wageType: w.wageType,
        wageRate: fromPaise(w.wageRate), overtimeRate: fromPaise(w.overtimeRatePerHour), notes: w.notes ?? "",
      }
    : {
        name: "", phone: "", address: "", emergencyContact: "", department: undefined as unknown as Values["department"], designation: "",
        joinedOn: format(new Date(), "yyyy-MM-dd"), wageType: "daily", wageRate: undefined as unknown as number, overtimeRate: 80, notes: "",
      };

export function WorkerFormSheet({ open, worker, onClose, onSaved }: { open: boolean; worker?: Worker; onClose: () => void; onSaved?: (w: Worker) => void }) {
  const create = useCreateWorker();
  const update = useUpdateWorker();
  const { data: roster = [] } = useWorkerRoster();
  const designations = [...new Set(roster.map((w) => w.designation))].sort();
  const editing = !!worker;

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(worker) });
  useEffect(() => { if (open) reset(defaults(worker)); }, [open, worker, reset]);
  const wageType = useWatch({ control, name: "wageType" });

  const onSubmit = handleSubmit(async (v) => {
    const input: WorkerInput = {
      name: v.name, phone: v.phone || undefined, address: v.address || undefined, emergencyContact: v.emergencyContact || undefined,
      department: v.department, designation: v.designation, joinedOn: v.joinedOn, wageType: v.wageType,
      wageRate: toPaise(v.wageRate), overtimeRatePerHour: toPaise(v.overtimeRate), notes: v.notes || undefined,
    };
    try {
      const saved = editing ? await update.mutateAsync({ id: worker.id, input }) : await create.mutateAsync(input);
      toast.success(editing ? `${saved.name} updated` : `${saved.name} added as ${saved.code}`);
      if (onSaved) onSaved(saved);
      else onClose();
    } catch (e) {
      toast.error("Couldn't save worker", { description: e instanceof Error ? e.message : undefined });
    }
  });
  useHotkeys({ "mod+enter": () => void onSubmit() }, open);

  const num = (n: "wageRate" | "overtimeRate") => register(n, { setValueAs: (x: string) => (x === "" ? undefined : Number(x)) });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width="md" onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("wk-name")?.focus(); }}>
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${worker.name}` : "Add worker"}</SheetTitle>
          <SheetDescription>{editing ? `${worker.code} · wage changes apply from the next payroll run.` : "An employee code is assigned automatically."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="contents">
          <SheetBody className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Personal details</h3>
              <FormField label="Full name" htmlFor="wk-name" error={errors.name?.message} required>
                <Input id="wk-name" aria-invalid={!!errors.name} {...register("name")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Mobile" htmlFor="wk-phone" error={errors.phone?.message}>
                  <Input id="wk-phone" inputMode="tel" placeholder="98xxxxxxxx" aria-invalid={!!errors.phone} {...register("phone")} />
                </FormField>
                <FormField label="Emergency contact" htmlFor="wk-emg" hint="Name and number">
                  <Input id="wk-emg" {...register("emergencyContact")} />
                </FormField>
              </div>
              <FormField label="Address" htmlFor="wk-addr">
                <Input id="wk-addr" {...register("address")} />
              </FormField>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Employment</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Department" error={errors.department?.message} required>
                  <Controller control={control} name="department" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!errors.department}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </FormField>
                <FormField label="Designation" htmlFor="wk-desig" error={errors.designation?.message} required>
                  <Input id="wk-desig" list="wk-designations" autoComplete="off" aria-invalid={!!errors.designation} {...register("designation")} />
                  <datalist id="wk-designations">{designations.map((d) => <option key={d} value={d} />)}</datalist>
                </FormField>
              </div>
              <FormField label="Joining date" htmlFor="wk-join" error={errors.joinedOn?.message} required className="w-1/2 pr-2">
                <Input id="wk-join" type="date" max={format(new Date(), "yyyy-MM-dd")} {...register("joinedOn")} />
              </FormField>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Wages</h3>
              <FormField label="Wage type" required>
                <Controller control={control} name="wageType" render={({ field }) => (
                  <div className="grid h-9 grid-cols-3 gap-1 rounded-lg border border-input p-0.5" role="radiogroup" aria-label="Wage type">
                    {(["daily", "monthly", "piece_rate"] as const).map((t) => (
                      <button key={t} type="button" role="radio" aria-checked={field.value === t} onClick={() => field.onChange(t)}
                        className={cn("rounded-md text-[13px] font-medium transition-colors", field.value === t ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}>
                        {WAGE_TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                )} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label={`Rate (₹${WAGE_UNIT[wageType]})`} htmlFor="wk-rate" error={errors.wageRate?.message} required
                  hint={wageType === "monthly" ? "Full monthly salary" : wageType === "piece_rate" ? "Rate per piece" : "Rate per day"}
                >
                  <Input id="wk-rate" type="number" step="0.01" min="0" className="font-semibold" aria-invalid={!!errors.wageRate} {...num("wageRate")} />
                </FormField>
                <FormField label="Overtime (₹/hour)" htmlFor="wk-ot" error={errors.overtimeRate?.message} required>
                  <Input id="wk-ot" type="number" step="1" min="0" aria-invalid={!!errors.overtimeRate} {...num("overtimeRate")} />
                </FormField>
              </div>
              <FormField label="Notes" htmlFor="wk-notes">
                <Textarea id="wk-notes" rows={2} {...register("notes")} />
              </FormField>
            </section>
          </SheetBody>
          <SheetFooter>
            <span className="mr-auto text-xs text-muted-foreground"><Kbd>{modKeyLabel}</Kbd> + <Kbd>Enter</Kbd> to save</span>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={create.isPending || update.isPending}>{editing ? "Save changes" : "Add worker"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
