import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Scroll, Package, Sparkles } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useParties } from "@/features/finance/api";
import type { Material } from "@/types/domain";
import { CATEGORIES, UNIT_LABEL, useCreateMaterial, useUpdateMaterial, type MaterialInput } from "../api";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a material name").max(80),
  code: z.string().trim().min(2, "Enter a code").max(20),
  category: z.enum(["Paper Roll", "Gum & Adhesive", "Ink", "Stitching Wire", "Strapping", "Consumable"]),
  unit: z.enum(["kg", "roll", "litre", "pcs", "bag"]),
  reorderLevel: z.number({ error: "Enter reorder alert level" }).min(0),
  gsm: z.number().positive().optional(),
  bf: z.number().positive().optional(),
  deckleInch: z.number().positive().optional(),
  preferredVendorId: z.string().optional(),
  notes: z.string().trim().max(300).optional(),
});
type Values = z.infer<typeof schema>;

const defaults = (m?: Material): Values =>
  m
    ? {
        name: m.name,
        code: m.code,
        category: m.category,
        unit: m.unit,
        reorderLevel: m.reorderLevel,
        gsm: m.gsm,
        bf: m.bf,
        deckleInch: m.deckleInch,
        preferredVendorId: m.preferredVendorId,
        notes: m.notes ?? "",
      }
    : {
        name: "",
        code: "",
        category: "Paper Roll",
        unit: "kg",
        reorderLevel: 1000,
        gsm: 140,
        bf: 18,
        deckleInch: 52,
        notes: "",
      };

export function MaterialFormSheet({
  open,
  material,
  onClose,
}: {
  open: boolean;
  material?: Material;
  onClose: () => void;
}) {
  const create = useCreateMaterial();
  const update = useUpdateMaterial();
  const { data: parties = [] } = useParties();
  const editing = !!material;

  // Mode: "paper" (Paper Reel) vs "other" (Consumables, Gum, Ink, Wire)
  const [mode, setMode] = useState<"paper" | "other">(
    material ? (material.category === "Paper Roll" ? "paper" : "other") : "paper"
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(material),
  });

  useEffect(() => {
    if (open) {
      reset(defaults(material));
      setMode(material ? (material.category === "Paper Roll" ? "paper" : "other") : "paper");
    }
  }, [open, material, reset]);

  const watchedGsm = watch("gsm");
  const watchedBf = watch("bf");
  const watchedDeckle = watch("deckleInch");

  // Auto-generate name and code for Paper Reels when creating
  useEffect(() => {
    if (!editing && mode === "paper") {
      const gsm = watchedGsm || 140;
      const bf = watchedBf ? ` ${watchedBf} BF` : "";
      const deckle = watchedDeckle ? ` ${watchedDeckle}"` : "";
      setValue("name", `Kraft Paper ${gsm} GSM${bf}${deckle}`);
      setValue("code", `KP-${gsm}${watchedDeckle ? `-${watchedDeckle}` : ""}`.toUpperCase());
      setValue("category", "Paper Roll");
      setValue("unit", "kg");
    }
  }, [editing, mode, watchedGsm, watchedBf, watchedDeckle, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    const isPaper = mode === "paper";
    const input: MaterialInput = {
      ...v,
      code: v.code.toUpperCase().replace(/\s+/g, "-"),
      category: isPaper ? "Paper Roll" : v.category,
      unit: isPaper ? "kg" : v.unit,
      preferredVendorId: v.preferredVendorId || undefined,
      notes: v.notes || undefined,
      ...(isPaper
        ? { gsm: v.gsm, bf: v.bf, deckleInch: v.deckleInch }
        : { gsm: undefined, bf: undefined, deckleInch: undefined }),
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: material.id, input });
        toast.success(`${input.name} updated`);
      } else {
        await create.mutateAsync(input);
        toast.success(`${input.name} added to inventory`, {
          description: "Click '+ Stock In' to record opening stock or incoming reels.",
        });
      }
      onClose();
    } catch (e) {
      toast.error("Couldn't save material", { description: e instanceof Error ? e.message : undefined });
    }
  });

  useHotkeys({ "mod+enter": () => void onSubmit() }, open);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width="md">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${material.name}` : "Add Material to Godown"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Update material specifications, reorder levels, or preferred vendor."
              : "Register raw materials, paper reels, or factory consumables."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="contents">
          <SheetBody className="space-y-5">
            {/* Type Switcher (only for new materials) */}
            {!editing && (
              <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-subtle border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setMode("paper");
                    setValue("category", "Paper Roll");
                    setValue("unit", "kg");
                    setValue("reorderLevel", 2000);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    mode === "paper"
                      ? "bg-card text-brand-800 shadow-xs border border-brand-200"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Scroll className="size-4 text-brand-600" />
                  <span>Kraft Paper Reel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("other");
                    setValue("category", "Gum & Adhesive");
                    setValue("unit", "kg");
                    setValue("name", "");
                    setValue("code", "");
                    setValue("reorderLevel", 100);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    mode === "other"
                      ? "bg-card text-brand-800 shadow-xs border border-brand-200"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Package className="size-4 text-brand-600" />
                  <span>Other / Consumable</span>
                </button>
              </div>
            )}

            {/* Paper Reel Mode Form */}
            {mode === "paper" && (
              <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-900 uppercase tracking-wider">
                  <Sparkles className="size-3.5 text-brand-600" /> Paper Reel Specifications
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="GSM" htmlFor="p-gsm" hint="e.g. 120, 140, 180" error={errors.gsm?.message} required>
                    <Input
                      id="p-gsm"
                      type="number"
                      autoFocus={!editing}
                      {...register("gsm", { valueAsNumber: true })}
                      placeholder="140"
                    />
                  </FormField>
                  <FormField label="BF (Burst Factor)" htmlFor="p-bf" hint="e.g. 18, 20, 22">
                    <Input
                      id="p-bf"
                      type="number"
                      {...register("bf", { valueAsNumber: true })}
                      placeholder="18"
                    />
                  </FormField>
                  <FormField label="Deckle (Inches)" htmlFor="p-deckle" hint="e.g. 48, 52, 60" error={errors.deckleInch?.message} required>
                    <Input
                      id="p-deckle"
                      type="number"
                      {...register("deckleInch", { valueAsNumber: true })}
                      placeholder="52"
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* Other Material Category Selector */}
            {mode === "other" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Category" required>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          if (v === "Ink") setValue("unit", "litre");
                          else if (v === "Strapping") setValue("unit", "roll");
                          else if (v === "Gum & Adhesive") setValue("unit", "kg");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.filter((c) => c !== "Paper Roll").map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>

                <FormField label="Unit of Measurement" required>
                  <Controller
                    control={control}
                    name="unit"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(UNIT_LABEL) as Values["unit"][]).map((u) => (
                            <SelectItem key={u} value={u}>
                              {UNIT_LABEL[u]} ({u})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
            )}

            {/* Material Name & Short Code */}
            <div className="grid grid-cols-[1fr_130px] gap-3">
              <FormField label="Material Name" htmlFor="mt-name" error={errors.name?.message} required>
                <Input
                  id="mt-name"
                  {...register("name")}
                  placeholder={mode === "paper" ? 'Kraft Paper 140 GSM 18 BF 52"' : "Yellow Starch / Gum Powder"}
                  aria-invalid={!!errors.name}
                />
              </FormField>
              <FormField label="Code / SKU" htmlFor="mt-code" error={errors.code?.message} required>
                <Input
                  id="mt-code"
                  className="uppercase font-mono text-xs"
                  {...register("code")}
                  placeholder={mode === "paper" ? "KP-140-52" : "GUM-01"}
                  aria-invalid={!!errors.code}
                />
              </FormField>
            </div>

            {/* Reorder Level & Preferred Supplier */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={`Reorder Alert Level (${mode === "paper" ? "kg" : watch("unit")})`}
                htmlFor="mt-reorder"
                hint="Alerts when stock drops below this"
                error={errors.reorderLevel?.message}
                required
              >
                <Input
                  id="mt-reorder"
                  type="number"
                  min="0"
                  {...register("reorderLevel", { valueAsNumber: true })}
                />
              </FormField>

              <FormField label="Preferred Vendor" hint="Optional default supplier">
                <Controller
                  control={control}
                  name="preferredVendorId"
                  render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Not specified</SelectItem>
                        {parties
                          .filter((p) => p.type === "vendor")
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>

            {/* Notes */}
            <FormField label="Notes / Storage Location" htmlFor="mt-notes" hint="Optional godown bay, shelf, or notes">
              <Textarea
                id="mt-notes"
                rows={2}
                placeholder="e.g. Godown Bay 3, Mills: Century / Trident"
                {...register("notes")}
              />
            </FormField>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {editing ? "Save Changes" : "Save Material"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
