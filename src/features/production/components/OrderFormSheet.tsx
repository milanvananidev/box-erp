import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { Calculator, Flame } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { FormField } from "@/components/shared/FormField";
import { modKeyLabel, useHotkeys } from "@/hooks/use-hotkeys";
import { blankSize, paperPerBox } from "@/lib/production";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoxSpec, ProductionOrder } from "@/types/domain";
import { useCreateOrder, useOrderCustomers, useUpdateOrder, type OrderInput } from "../api";

const dim = (label: string) =>
  z.number({ error: `Enter ${label}` }).int("Whole mm only").min(20, "Too small").max(3000, "Too large");

const schema = z
  .object({
    customer: z.string().trim().min(2, "Enter the customer"),
    customerRef: z.string().trim().max(40).optional(),
    product: z.string().trim().max(80).optional(),
    ply: z.union([z.literal(3), z.literal(5), z.literal(7)]),
    flute: z.enum(["A", "B", "C", "E", "BC"]),
    gsm: z.number({ error: "Enter GSM" }).int().min(80, "Min 80").max(450, "Max 450"),
    lengthMm: dim("length"),
    widthMm: dim("width"),
    heightMm: dim("height"),
    printed: z.boolean(),
    colors: z.number().int().min(1).max(6).optional(),
    plannedQty: z.number({ error: "Enter quantity" }).int("Whole pieces only").min(1, "At least 1").max(10_000_000),
    priority: z.enum(["normal", "urgent"]),
    startDate: z.string().min(1, "Required"),
    dueDate: z.string().min(1, "Required"),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.dueDate >= v.startDate, { path: ["dueDate"], message: "Due date is before start date" })
  .refine((v) => v.ply !== 3 || v.flute !== "BC", { path: ["flute"], message: "BC (double wall) needs 5 or 7 ply" });

type FormValues = z.infer<typeof schema>;

const autoName = (v: Pick<FormValues, "ply" | "printed">) => `${v.ply} Ply ${v.printed ? "Printed " : ""}Box`;

function defaults(order?: ProductionOrder): FormValues {
  if (order)
    return {
      customer: order.customer,
      customerRef: order.customerRef ?? "",
      product: order.product,
      ...order.spec,
      colors: order.spec.colors,
      plannedQty: order.plannedQty,
      priority: order.priority,
      startDate: order.startDate,
      dueDate: order.dueDate,
      notes: order.notes ?? "",
    };
  const today = new Date();
  return {
    customer: "", customerRef: "", product: "",
    ply: 5, flute: "BC", gsm: 150,
    lengthMm: undefined as unknown as number, widthMm: undefined as unknown as number, heightMm: undefined as unknown as number,
    printed: false, colors: undefined,
    plannedQty: undefined as unknown as number, priority: "normal",
    startDate: format(today, "yyyy-MM-dd"), dueDate: format(addDays(today, 5), "yyyy-MM-dd"), notes: "",
  };
}

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid h-9 auto-cols-fr grid-flow-col gap-1 rounded-lg border border-input p-0.5">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("rounded-md px-2 text-[13px] font-medium transition-colors", value === o.value ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PlanningPanel({ v }: { v: Partial<FormValues> }) {
  const ok = v.lengthMm! > 0 && v.widthMm! > 0 && v.heightMm! > 0 && v.gsm! > 0 && v.ply && v.flute;
  if (!ok) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-[13px] text-muted-foreground">
        <Calculator className="mb-2 size-4" /> Enter the box size to see the sheet size and how much paper this order needs.
      </div>
    );
  }
  const spec = { ply: v.ply!, flute: v.flute!, gsm: v.gsm!, lengthMm: v.lengthMm!, widthMm: v.widthMm!, heightMm: v.heightMm!, printed: !!v.printed } as BoxSpec;
  const blank = blankSize(spec);
  const grams = paperPerBox(spec);
  const qty = v.plannedQty && v.plannedQty > 0 ? v.plannedQty : 0;
  const kg = (grams * qty * 1.03) / 1000; // +3% expected wastage
  return (
    <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-[13px]">
      <p className="flex items-center gap-2 font-medium text-brand-800"><Calculator className="size-4" /> Planning estimate</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 tabular">
        <dt className="text-muted-foreground">Sheet (L × deckle)</dt><dd className="text-right font-medium">{blank.lengthMm} × {blank.widthMm} mm</dd>
        <dt className="text-muted-foreground">Paper per box</dt><dd className="text-right font-medium">≈ {formatQty(grams)} g</dd>
        <dt className="text-muted-foreground">Paper for order</dt><dd className="text-right font-semibold text-foreground">{qty ? `≈ ${formatQty(Math.ceil(kg))} kg` : "—"}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">RSC (FEFCO 0201), 35 mm joint, includes 3% wastage. Approximate. The corrugator operator applies machine trims.</p>
    </div>
  );
}

export function OrderFormSheet({ open, order, onClose, onSaved }: { open: boolean; order?: ProductionOrder; onClose: () => void; onSaved?: (o: ProductionOrder) => void }) {
  const create = useCreateOrder();
  const update = useUpdateOrder();
  const { data: customers = [] } = useOrderCustomers();
  const editing = !!order;
  const locked = editing && order.producedQty > 0; // spec can't change once board is made

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(order) });
  const { register, control, handleSubmit, reset, formState: { errors } } = form;
  useEffect(() => { if (open) reset(defaults(order)); }, [open, order, reset]);

  const v = useWatch({ control }) as Partial<FormValues>;

  const onSubmit = handleSubmit(async (f) => {
    const input: OrderInput = {
      customer: f.customer,
      customerRef: f.customerRef || undefined,
      product: f.product || autoName(f),
      spec: { ply: f.ply, flute: f.flute, gsm: f.gsm, lengthMm: f.lengthMm, widthMm: f.widthMm, heightMm: f.heightMm, printed: f.printed, colors: f.printed ? (f.colors ?? 1) : undefined },
      plannedQty: f.plannedQty,
      priority: f.priority,
      startDate: f.startDate,
      dueDate: f.dueDate,
      notes: f.notes || undefined,
    };
    try {
      const saved = editing ? await update.mutateAsync({ id: order.id, input }) : await create.mutateAsync(input);
      toast.success(editing ? `${saved.orderNo} updated` : `${saved.orderNo} created`, { description: `${saved.customer} · ${formatQty(saved.plannedQty)} pcs` });
      // onSaved replaces onClose so the parent can close and navigate in one URL update
      if (onSaved) onSaved(saved);
      else onClose();
    } catch (e) {
      toast.error("Couldn't save order", { description: e instanceof Error ? e.message : undefined });
    }
  });
  useHotkeys({ "mod+enter": () => void onSubmit() }, open);

  const num = (name: keyof FormValues) => register(name, { setValueAs: (x: string) => (x === "" ? undefined : Number(x)) });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width="lg" onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("po-customer")?.focus(); }}>
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${order.orderNo}` : "New production order"}</SheetTitle>
          <SheetDescription>
            {editing ? "Change quantities, dates or notes." : "Plan a job for the shop floor. The invoice for it is raised in Vyapar."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="contents">
          <SheetBody>
            <div className="grid grid-cols-[1fr_260px] gap-6">
              <div className="space-y-6">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">Customer & product</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Customer" htmlFor="po-customer" error={errors.customer?.message} required>
                      <Input id="po-customer" list="po-customers" autoComplete="off" placeholder="e.g. Shakti Industries" aria-invalid={!!errors.customer} {...register("customer")} />
                      <datalist id="po-customers">{customers.map((c) => <option key={c} value={c} />)}</datalist>
                    </FormField>
                    <FormField label="Customer PO / ref" htmlFor="po-ref" hint="Optional">
                      <Input id="po-ref" placeholder="SO-2231" {...register("customerRef")} />
                    </FormField>
                  </div>
                  <FormField label="Product name" htmlFor="po-product" hint={`Leave blank to use “${autoName({ ply: v.ply ?? 5, printed: !!v.printed })}”`}>
                    <Input id="po-product" placeholder={autoName({ ply: v.ply ?? 5, printed: !!v.printed })} {...register("product")} />
                  </FormField>
                </section>

                <section className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Box specification</h3>
                    {locked && <span className="text-xs text-muted-foreground">Locked: production has started</span>}
                  </div>
                  <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField label="Length (mm)" htmlFor="po-l" error={errors.lengthMm?.message} required>
                        <Input id="po-l" type="number" inputMode="numeric" aria-invalid={!!errors.lengthMm} {...num("lengthMm")} />
                      </FormField>
                      <FormField label="Width (mm)" htmlFor="po-w" error={errors.widthMm?.message} required>
                        <Input id="po-w" type="number" inputMode="numeric" aria-invalid={!!errors.widthMm} {...num("widthMm")} />
                      </FormField>
                      <FormField label="Height (mm)" htmlFor="po-h" error={errors.heightMm?.message} required>
                        <Input id="po-h" type="number" inputMode="numeric" aria-invalid={!!errors.heightMm} {...num("heightMm")} />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField label="Ply" required>
                        <Controller control={control} name="ply" render={({ field }) => (
                          <Segmented label="Ply" value={field.value} onChange={field.onChange} options={[{ value: 3, label: "3" }, { value: 5, label: "5" }, { value: 7, label: "7" }]} />
                        )} />
                      </FormField>
                      <FormField label="Flute" error={errors.flute?.message} required>
                        <Controller control={control} name="flute" render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={locked}>
                            <SelectTrigger aria-invalid={!!errors.flute}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A">A flute</SelectItem>
                              <SelectItem value="B">B flute</SelectItem>
                              <SelectItem value="C">C flute</SelectItem>
                              <SelectItem value="E">E flute</SelectItem>
                              <SelectItem value="BC">BC double wall</SelectItem>
                            </SelectContent>
                          </Select>
                        )} />
                      </FormField>
                      <FormField label="Paper GSM" htmlFor="po-gsm" error={errors.gsm?.message} required>
                        <Input id="po-gsm" type="number" inputMode="numeric" aria-invalid={!!errors.gsm} {...num("gsm")} />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField label="Printing" className="col-span-2">
                        <Controller control={control} name="printed" render={({ field }) => (
                          <Segmented label="Printing" value={field.value ? "yes" : "no"} onChange={(x) => field.onChange(x === "yes")}
                            options={[{ value: "no", label: "Plain" }, { value: "yes", label: "Printed" }]} />
                        )} />
                      </FormField>
                      {v.printed && (
                        <FormField label="Colours" htmlFor="po-colors">
                          <Input id="po-colors" type="number" min={1} max={6} placeholder="1" {...num("colors")} />
                        </FormField>
                      )}
                    </div>
                  </fieldset>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">Schedule</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField label="Planned qty (pcs)" htmlFor="po-qty" error={errors.plannedQty?.message} required>
                      <Input id="po-qty" type="number" inputMode="numeric" className="font-semibold" aria-invalid={!!errors.plannedQty} {...num("plannedQty")} />
                    </FormField>
                    <FormField label="Start date" htmlFor="po-start" error={errors.startDate?.message} required>
                      <Input id="po-start" type="date" {...register("startDate")} />
                    </FormField>
                    <FormField label="Due date" htmlFor="po-due" error={errors.dueDate?.message} required>
                      <Input id="po-due" type="date" aria-invalid={!!errors.dueDate} {...register("dueDate")} />
                    </FormField>
                  </div>
                  <FormField label="Priority">
                    <Controller control={control} name="priority" render={({ field }) => (
                      <div className="w-64">
                        <Segmented label="Priority" value={field.value} onChange={field.onChange} options={[{ value: "normal", label: "Normal" }, { value: "urgent", label: "Urgent" }]} />
                      </div>
                    )} />
                  </FormField>
                  <FormField label="Notes" htmlFor="po-notes" hint="Packing, bundle size, delivery instructions">
                    <Textarea id="po-notes" rows={2} {...register("notes")} />
                  </FormField>
                </section>
              </div>

              <aside className="sticky top-0 space-y-4 self-start">
                <PlanningPanel v={v} />
                {v.priority === "urgent" && (
                  <div className="flex gap-2 rounded-xl bg-danger-soft p-3 text-[13px] text-danger-foreground">
                    <Flame className="mt-0.5 size-4 shrink-0" /> Urgent orders appear first on the dashboard and production list.
                  </div>
                )}
              </aside>
            </div>
          </SheetBody>
          <SheetFooter>
            <span className="mr-auto text-xs text-muted-foreground"><Kbd>{modKeyLabel}</Kbd> + <Kbd>Enter</Kbd> to save</span>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={create.isPending || update.isPending}>{editing ? "Save changes" : "Create order"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
