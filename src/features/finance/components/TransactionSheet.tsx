import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { FormField } from "@/components/shared/FormField";
import { useUI } from "@/stores/ui";
import { formatDate, formatINR, toPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { modKeyLabel, useHotkeys } from "@/hooks/use-hotkeys";
import { useCategories, useCreateTransaction, useParties, useSimilarTransactions } from "../api";
import { modeLabel } from "./badges";

const schema = z.object({
  direction: z.enum(["in", "out"]),
  date: z.string().min(1, "Date is required"),
  amount: z.number({ error: "Enter an amount" }).positive("Amount must be greater than zero").max(1e9, "Amount looks too large"),
  category: z.string().min(1, "Choose a category"),
  mode: z.enum(["cash", "bank", "upi"]),
  partyId: z.string().optional(),
  particulars: z.string().trim().min(2, "Describe the transaction").max(200),
  reference: z.string().trim().max(60).optional(),
});
type FormValues = z.infer<typeof schema>;

const NO_PARTY = "__none";

export function TransactionSheet() {
  const { open, direction } = useUI((s) => s.txnSheet);
  const close = useUI((s) => s.closeTxnSheet);
  const create = useCreateTransaction();
  const { data: cats = [] } = useCategories();
  const { data: parties = [] } = useParties();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { direction, date: format(new Date(), "yyyy-MM-dd"), mode: "bank", category: "", particulars: "", reference: "" },
  });
  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = form;

  useEffect(() => {
    if (open)
      reset({ direction, date: format(new Date(), "yyyy-MM-dd"), mode: "bank", category: "", particulars: "", reference: "", partyId: undefined, amount: undefined as unknown as number });
  }, [open, direction, reset]);

  const [dir, amount, date, partyId] = useWatch({ control, name: ["direction", "amount", "date", "partyId"] });
  const dupCheck = useSimilarTransactions(
    { direction: dir, amount: Number.isFinite(amount) ? toPaise(amount) : 0, date, partyId },
    open,
  );
  const duplicates = dupCheck.data ?? [];

  const onSubmit = handleSubmit(async (v) => {
    try {
      await create.mutateAsync({ ...v, amount: toPaise(v.amount), partyId: v.partyId || undefined, reference: v.reference || undefined });
      toast.success(`${v.direction === "in" ? "Income" : "Expense"} of ${formatINR(toPaise(v.amount))} saved`);
      close();
    } catch (e) {
      toast.error("Couldn't save transaction", { description: e instanceof Error ? e.message : undefined });
    }
  });

  useHotkeys({ "mod+enter": () => void onSubmit() }, open);

  // Advances are given from Workers & HR so payroll can recover them.
  const visibleCats = cats.filter((c) => c.direction === dir && c.treatment !== "advance");
  const visibleParties = parties.filter((p) => (dir === "in" ? p.type === "customer" : p.type === "vendor"));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent width="md" onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("txn-amount")?.focus(); }}>
        <SheetHeader>
          <SheetTitle>New transaction</SheetTitle>
          <SheetDescription>Record a cash, bank or UPI movement. Sales invoices stay in Vyapar.</SheetDescription>
        </SheetHeader>
        <form id="txn-form" onSubmit={onSubmit} className="contents">
          <SheetBody className="space-y-5">
            {/* Direction toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {(["in", "out"] as const).map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => { setValue("direction", d); setValue("category", ""); setValue("partyId", undefined); }}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    dir === d
                      ? d === "in" ? "bg-card text-success-foreground shadow-sm font-bold" : "bg-card text-danger-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d === "in" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  {d === "in" ? "+ Income (Cash In)" : "− Expense (Cash Out)"}
                </button>
              ))}
            </div>

            {/* Quick Box Factory Presets */}
            <div className="space-y-1.5 p-3 rounded-xl bg-subtle/80 border border-border/70">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Box Factory Presets
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dir === "in" ? (
                  <>
                    {[
                      { label: "Client Payment", cat: "Sales Receipt", note: "Client payment for corrugated boxes" },
                      { label: "Scrap Paper Sold", cat: "Scrap Sale", note: "Corrugation waste / kraft scrap paper sold to mill" },
                      { label: "Loan / Capital", cat: "Loan Received", note: "Partner credit / loan received" },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setValue("category", p.cat);
                          if (!form.getValues("particulars")) setValue("particulars", p.note);
                        }}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                          form.watch("category") === p.cat
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-2xs"
                            : "border-border text-muted-foreground hover:bg-card hover:text-foreground",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { label: "Kraft Paper Reel", cat: "Raw Material", note: "Paper reel purchase from mill" },
                      { label: "Gum & Consumables", cat: "Raw Material", note: "Starch gum / ink / stitching wire" },
                      { label: "Electricity Bill", cat: "Electricity", note: "Factory electricity power bill" },
                      { label: "Transport & Freight", cat: "Transport & Freight", note: "Tempo / truck freight for box delivery" },
                      { label: "Machine Repairs", cat: "Repairs & Maintenance", note: "Corrugator parts / machine repairs" },
                      { label: "Factory Rent", cat: "Rent", note: "Godown / factory shed rent" },
                      { label: "Wages & Labour", cat: "Wages & Salary", note: "Worker wages payout" },
                      { label: "Tea & Misc", cat: "Miscellaneous", note: "Staff tea & refreshment expenses" },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setValue("category", p.cat);
                          if (!form.getValues("particulars")) setValue("particulars", p.note);
                        }}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                          form.watch("category") === p.cat
                            ? "bg-amber-50 text-amber-900 border-amber-300 font-bold shadow-2xs"
                            : "border-border text-muted-foreground hover:bg-card hover:text-foreground",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Amount (₹)" htmlFor="txn-amount" error={errors.amount?.message} required>
                <Input id="txn-amount" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" aria-invalid={!!errors.amount}
                  className="text-base font-semibold" {...register("amount", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Date" htmlFor="txn-date" error={errors.date?.message} required>
                <Input id="txn-date" type="date" aria-invalid={!!errors.date} max={format(new Date(), "yyyy-MM-dd")} {...register("date")} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Category" error={errors.category?.message} required>
                <Controller control={control} name="category" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={!!errors.category}><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {visibleCats.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </FormField>
              <FormField label="Payment mode" required>
                <Controller control={control} name="mode" render={({ field }) => (
                  <div className="grid h-9 grid-cols-3 gap-1 rounded-lg border border-input p-0.5">
                    {(["cash", "bank", "upi"] as const).map((m) => (
                      <button type="button" key={m} onClick={() => field.onChange(m)}
                        className={cn("rounded-md text-[13px] font-medium transition-colors", field.value === m ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}>
                        {modeLabel[m]}
                      </button>
                    ))}
                  </div>
                )} />
              </FormField>
            </div>

            <FormField label={dir === "in" ? "Customer" : "Vendor / Payee"} hint="Optional — links the entry to the party ledger">
              <Controller control={control} name="partyId" render={({ field }) => (
                <Select value={field.value ?? NO_PARTY} onValueChange={(v) => field.onChange(v === NO_PARTY ? undefined : v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARTY}>None</SelectItem>
                    {visibleParties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>

            <FormField label="Particulars" htmlFor="txn-particulars" error={errors.particulars?.message} required>
              <Textarea id="txn-particulars" rows={2} placeholder="e.g. Kraft paper 150 GSM – 4 rolls" aria-invalid={!!errors.particulars} {...register("particulars")} />
            </FormField>

            <FormField label="Reference" htmlFor="txn-ref" hint="Cheque no., UTR, UPI ref or bill no.">
              <Input id="txn-ref" placeholder="Optional" {...register("reference")} />
            </FormField>

            {duplicates.length > 0 && (
              <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm" role="status">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                <div className="space-y-1.5">
                  <p className="font-medium text-warning-foreground">Possible duplicate</p>
                  <p className="text-[#5f4a00]">A matching entry already exists. If it was imported from Vyapar, don't record it again or it will be counted twice.</p>
                  <ul className="space-y-0.5 text-[13px] text-[#5f4a00] tabular">
                    {duplicates.map((d) => (
                      <li key={d.id}>
                        {formatDate(d.date)} · {formatINR(d.amount)} · {d.particulars}
                        {d.source === "vyapar_import" && <span className="font-medium"> (Vyapar {d.externalRef})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </SheetBody>
          <SheetFooter>
            <span className="mr-auto text-xs text-muted-foreground">
              <Kbd>{modKeyLabel}</Kbd> + <Kbd>Enter</Kbd> to save
            </span>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Save transaction</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
