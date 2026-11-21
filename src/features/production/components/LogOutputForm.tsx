import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { STAGE_LABEL, WASTAGE_REASONS, stagesFor, workingStage } from "@/lib/production";
import { formatQty } from "@/lib/format";
import type { ProductionOrder, ProductionStage, WastageReason } from "@/types/domain";
import { useLogEntry } from "../api";

const qty = z.number().int("Whole pieces").min(0, "Can't be negative").max(1_000_000);
const schema = z
  .object({
    date: z.string().min(1, "Required"),
    stage: z.string().min(1),
    goodQty: qty,
    wastageQty: qty,
    wastageReason: z.string().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.goodQty + v.wastageQty > 0, { path: ["goodQty"], message: "Enter good pieces or wastage" })
  .refine((v) => v.wastageQty === 0 || !!v.wastageReason, { path: ["wastageReason"], message: "Pick a reason" });
type Values = z.infer<typeof schema>;

export function LogOutputForm({ order }: { order: ProductionOrder }) {
  const log = useLogEntry();
  const stages: ProductionStage[] = stagesFor(order.spec).filter((s) => s !== "planned" && s !== "completed");
  const initial = (): Values => {
    const ws = workingStage(order);
    return { date: format(new Date(), "yyyy-MM-dd"), stage: stages.includes(ws) ? ws : stages[0]!, goodQty: 0, wastageQty: 0, wastageReason: undefined, note: "" };
  };
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial() });
  useEffect(() => reset(initial()), [order.id, order.stage]);

  const [good, waste] = useWatch({ control, name: ["goodQty", "wastageQty"] });
  const after = order.producedQty + (Number.isFinite(good) ? good : 0);
  const over = after > order.plannedQty;

  const num = (n: "goodQty" | "wastageQty") => register(n, { setValueAs: (x: string) => (x === "" ? 0 : Number(x)) });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await log.mutateAsync({
        orderId: order.id,
        date: v.date,
        stage: v.stage as ProductionStage,
        goodQty: v.goodQty,
        wastageQty: v.wastageQty,
        wastageReason: v.wastageQty > 0 ? (v.wastageReason as WastageReason) : undefined,
        note: v.note || undefined,
      });
      toast.success(`Logged ${formatQty(v.goodQty)} pcs on ${order.orderNo}`);
      reset({ ...initial(), date: v.date, stage: v.stage });
    } catch (e) {
      toast.error("Couldn't log output", { description: e instanceof Error ? e.message : undefined });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border bg-subtle p-4">
      <div className="grid grid-cols-[130px_1fr_110px_110px] gap-3">
        <FormField label="Date" htmlFor="lo-date" error={errors.date?.message}>
          <Input id="lo-date" type="date" max={format(new Date(), "yyyy-MM-dd")} {...register("date")} />
        </FormField>
        <FormField label="Stage">
          <Controller control={control} name="stage" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Good pcs" htmlFor="lo-good" error={errors.goodQty?.message}>
          <Input id="lo-good" type="number" inputMode="numeric" min={0} aria-invalid={!!errors.goodQty} {...num("goodQty")} />
        </FormField>
        <FormField label="Wastage pcs" htmlFor="lo-waste" error={errors.wastageQty?.message}>
          <Input id="lo-waste" type="number" inputMode="numeric" min={0} {...num("wastageQty")} />
        </FormField>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
        <FormField label="Wastage reason" error={errors.wastageReason?.message}>
          <Controller control={control} name="wastageReason" render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!(waste > 0)}>
              <SelectTrigger aria-invalid={!!errors.wastageReason}><SelectValue placeholder={waste > 0 ? "Select reason" : "No wastage"} /></SelectTrigger>
              <SelectContent>{Object.entries(WASTAGE_REASONS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Note" htmlFor="lo-note">
          <Input id="lo-note" placeholder="Shift, operator, machine…" {...register("note")} />
        </FormField>
        <Button type="submit" loading={log.isPending}><Plus /> Log output</Button>
      </div>
      {over && (
        <p className="text-xs text-warning-foreground tabular">
          This takes the order to {formatQty(after)} of {formatQty(order.plannedQty)} pcs (+{formatQty(after - order.plannedQty)} over plan). Fine for small overruns. Otherwise check the quantity.
        </p>
      )}
    </form>
  );
}
