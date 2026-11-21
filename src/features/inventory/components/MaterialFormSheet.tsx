import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useParties } from "@/features/finance/api";
import type { Material } from "@/types/domain";
import { CATEGORIES, UNIT_LABEL, useCreateMaterial, useUpdateMaterial, type MaterialInput } from "../api";

const optNum = z.number().positive().optional();
const schema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  code: z.string().trim().min(2, "Enter a short code").max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and - only"),
  category: z.enum(["Paper Roll", "Gum & Adhesive", "Ink", "Stitching Wire", "Strapping", "Consumable"]),
  unit: z.enum(["kg", "roll", "litre", "pcs", "bag"]),
  reorderLevel: z.number({ error: "Enter reorder level" }).min(0),
  gsm: optNum, bf: optNum, deckleInch: optNum,
  preferredVendorId: z.string().optional(),
  notes: z.string().trim().max(300).optional(),
});
type Values = z.infer<typeof schema>;
const NONE = "__none";

const defaults = (m?: Material): Values =>
  m
    ? { name: m.name, code: m.code, category: m.category, unit: m.unit, reorderLevel: m.reorderLevel, gsm: m.gsm, bf: m.bf, deckleInch: m.deckleInch, preferredVendorId: m.preferredVendorId, notes: m.notes ?? "" }
    : { name: "", code: "", category: "Paper Roll", unit: "kg", reorderLevel: undefined as unknown as number, notes: "" };

export function MaterialFormSheet({ open, material, onClose }: { open: boolean; material?: Material; onClose: () => void }) {
  const create = useCreateMaterial();
  const update = useUpdateMaterial();
  const { data: parties = [] } = useParties();
  const editing = !!material;
  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(material) });
  useEffect(() => { if (open) reset(defaults(material)); }, [open, material, reset]);
  const category = useWatch({ control, name: "category" });
  const paper = category === "Paper Roll";
  const n = (k: keyof Values) => register(k, { setValueAs: (x: string) => (x === "" ? undefined : Number(x)) });

  const onSubmit = handleSubmit(async (v) => {
    const input: MaterialInput = { ...v, code: v.code.toUpperCase(), preferredVendorId: v.preferredVendorId || undefined, notes: v.notes || undefined, ...(paper ? {} : { gsm: undefined, bf: undefined, deckleInch: undefined }) };
    try {
      if (editing) await update.mutateAsync({ id: material.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? `${input.name} updated` : `${input.name} added`, { description: editing ? undefined : "Record an inward to bring in opening stock." });
      onClose();
    } catch (e) {
      toast.error("Couldn't save material", { description: e instanceof Error ? e.message : undefined });
    }
  });
  useHotkeys({ "mod+enter": () => void onSubmit() }, open);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width="sm">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${material.name}` : "New material"}</SheetTitle>
          <SheetDescription>Stock is changed only through inward, issue and adjustment entries.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="contents">
          <SheetBody className="space-y-4">
            <div className="grid grid-cols-[1fr_120px] gap-4">
              <FormField label="Name" htmlFor="mt-name" error={errors.name?.message} required>
                <Input id="mt-name" autoFocus {...register("name")} aria-invalid={!!errors.name} />
              </FormField>
              <FormField label="Code" htmlFor="mt-code" error={errors.code?.message} required>
                <Input id="mt-code" className="uppercase" {...register("code")} aria-invalid={!!errors.code} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Category" required>
                <Controller control={control} name="category" render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v === "Paper Roll") setValue("unit", "kg"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </FormField>
              <FormField label="Unit" required>
                <Controller control={control} name="unit" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(UNIT_LABEL) as Values["unit"][]).map((u) => <SelectItem key={u} value={u}>{UNIT_LABEL[u]}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </FormField>
            </div>
            {paper && (
              <div className="grid grid-cols-3 gap-4">
                <FormField label="GSM" htmlFor="mt-gsm"><Input id="mt-gsm" type="number" {...n("gsm")} /></FormField>
                <FormField label="BF" htmlFor="mt-bf" hint="Bursting factor"><Input id="mt-bf" type="number" {...n("bf")} /></FormField>
                <FormField label="Deckle (in)" htmlFor="mt-deckle"><Input id="mt-deckle" type="number" {...n("deckleInch")} /></FormField>
              </div>
            )}
            <FormField label="Reorder level" htmlFor="mt-reorder" error={errors.reorderLevel?.message} hint="An alert appears when stock falls to this level" required>
              <Input id="mt-reorder" type="number" min="0" {...n("reorderLevel")} className="w-40" aria-invalid={!!errors.reorderLevel} />
            </FormField>
            <FormField label="Usual vendor">
              <Controller control={control} name="preferredVendorId" render={({ field }) => (
                <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {parties.filter((p) => p.type === "vendor").map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </FormField>
            <FormField label="Notes" htmlFor="mt-notes"><Textarea id="mt-notes" rows={2} {...register("notes")} /></FormField>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={create.isPending || update.isPending}>{editing ? "Save changes" : "Add material"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
