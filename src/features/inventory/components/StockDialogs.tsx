import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { formatINR, formatQty, toPaise, fromPaise } from "@/lib/format";
import { paperPerBox } from "@/lib/production";
import { cn } from "@/lib/utils";
import { useParties } from "@/features/finance/api";
import { useProductionOrders } from "@/features/production/api";
import type { AdjustmentReason, PaymentMode } from "@/types/domain";
import { ADJUST_REASONS, UNIT_LABEL, useMaterials, useMovements, useStockAdjust, useStockInward, useStockIssue, type MaterialRow } from "../api";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : undefined);
const NONE = "__none";

function MaterialSelect({ value, onChange, disabled, list }: { value: string; onChange: (v: string) => void; disabled?: boolean; list: MaterialRow[] }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
      <SelectContent>
        {list.filter((m) => m.active).map((m) => (
          <SelectItem key={m.id} value={m.id}>{m.name} · {formatQty(m.stock, UNIT_LABEL[m.unit])}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StockLine({ m, after, label }: { m: MaterialRow; after: number | null; label: string }) {
  const low = after != null && after <= m.reorderLevel;
  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl bg-subtle p-3 text-sm tabular">
      <div><div className="text-xs text-muted-foreground">In stock</div><div className="font-semibold">{formatQty(m.stock, UNIT_LABEL[m.unit])}</div></div>
      <div><div className="text-xs text-muted-foreground">{label}</div><div className={cn("font-semibold", after != null && after < 0 && "text-danger-foreground", low && after! >= 0 && "text-warning-foreground")}>{after == null ? "—" : formatQty(after, UNIT_LABEL[m.unit])}</div></div>
      <div><div className="text-xs text-muted-foreground">Avg cost</div><div className="font-semibold">{formatINR(m.avgCost, { precise: true })}/{m.unit}</div></div>
    </div>
  );
}

/* ───────── Inward (goods received) ───────── */
export function InwardDialog({ open, materialId, onOpenChange }: { open: boolean; materialId?: string; onOpenChange: (v: boolean) => void }) {
  const { data: list = [] } = useMaterials();
  const { data: parties = [] } = useParties();
  const inward = useStockInward();
  const [mid, setMid] = useState("");
  const [date, setDate] = useState(todayISO());
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [vendor, setVendor] = useState(NONE);
  const [bill, setBill] = useState("");
  const [reels, setReels] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("bank");

  const m = list.find((x) => x.id === mid);
  useEffect(() => {
    if (!open) return;
    setMid(materialId ?? ""); setDate(todayISO()); setQty(""); setBill(""); setReels(""); setPayNow(false); setMode("bank");
  }, [open, materialId]);
  useEffect(() => {
    if (m) { setRate(m.avgCost ? String(fromPaise(m.avgCost)) : ""); setVendor(m.preferredVendorId ?? NONE); }
  }, [m?.id]);

  const q = num(qty), r = num(rate);
  const value = q > 0 && r > 0 ? Math.round(q * toPaise(r)) : 0;
  const valid = !!m && q > 0 && r > 0 && !!date && (!payNow || vendor !== NONE);

  const submit = async () => {
    if (!valid || !m) return;
    try {
      await inward.mutateAsync({
        materialId: m.id, date, qty: q, rate: toPaise(r), vendorId: vendor === NONE ? undefined : vendor, billNo: bill || undefined,
        reels: reels ? Math.floor(num(reels)) : undefined, payNow: payNow ? { mode } : undefined,
      });
      toast.success(`Received ${formatQty(q, UNIT_LABEL[m.unit])} of ${m.name}`, { description: payNow ? `Payment of ${formatINR(value)} added to the cash book` : "Stock and average cost updated" });
      onOpenChange(false);
    } catch (e) { toast.error("Couldn't record inward", { description: errMsg(e) }); }
  };
  useHotkeys({ "mod+enter": () => void submit() }, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowDownToLine className="size-5 text-success" /> Material inward</DialogTitle>
          <DialogDescription>Goods received from a vendor. The purchase bill itself stays in Vyapar.</DialogDescription>
        </DialogHeader>
        <FormField label="Material" required>
          <MaterialSelect value={mid} onChange={setMid} disabled={!!materialId} list={list} />
        </FormField>
        {m && <StockLine m={m} label="After inward" after={q > 0 ? m.stock + q : null} />}
        <div className="grid grid-cols-3 gap-4">
          <FormField label={`Quantity (${m ? UNIT_LABEL[m.unit] : "qty"})`} htmlFor="in-qty" required>
            <Input id="in-qty" type="number" min="0" step="0.01" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} className="font-semibold" />
          </FormField>
          <FormField label={`Rate (₹/${m?.unit ?? "unit"})`} htmlFor="in-rate" required>
            <Input id="in-rate" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          </FormField>
          <FormField label="Date" htmlFor="in-date" required>
            <Input id="in-date" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Vendor" className="col-span-2" required={payNow}>
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not specified</SelectItem>
                {parties.filter((p) => p.type === "vendor").map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Bill / challan no." htmlFor="in-bill">
            <Input id="in-bill" value={bill} onChange={(e) => setBill(e.target.value)} />
          </FormField>
        </div>
        {m?.category === "Paper Roll" && (
          <FormField label="Number of reels" htmlFor="in-reels" hint="Optional, for counting rolls in the godown" className="w-1/3">
            <Input id="in-reels" type="number" min="0" value={reels} onChange={(e) => setReels(e.target.value)} />
          </FormField>
        )}
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="size-4 accent-[var(--brand-500)]" />
            <span>Paid now. Add <b>{formatINR(value)}</b> to the cash book.</span>
          </label>
          {payNow && (
            <div className="grid h-8 grid-cols-3 gap-1 rounded-lg border border-input p-0.5">
              {(["cash", "bank", "upi"] as const).map((x) => (
                <button key={x} type="button" onClick={() => setMode(x)} className={cn("rounded-md px-2 text-xs font-medium", mode === x ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}>
                  {x === "upi" ? "UPI" : x[0]!.toUpperCase() + x.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        {!payNow && <p className="-mt-2 text-xs text-muted-foreground">Paying later? Record the payment in Income &amp; Expenses when you pay, so it's only counted once.</p>}
        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground tabular">Value <b className="text-foreground">{formatINR(value)}</b></span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} loading={inward.isPending} onClick={submit}>Record inward</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Issue to production ───────── */
export function IssueDialog({ open, materialId, orderId, onOpenChange }: { open: boolean; materialId?: string; orderId?: string; onOpenChange: (v: boolean) => void }) {
  const { data: list = [] } = useMaterials();
  const { data: orders = [] } = useProductionOrders();
  const issue = useStockIssue();
  const [mid, setMid] = useState("");
  const [date, setDate] = useState(todayISO());
  const [qty, setQty] = useState("");
  const [oid, setOid] = useState(NONE);
  const [note, setNote] = useState("");
  const m = list.find((x) => x.id === mid);
  const { data: ledger } = useMovements(undefined, open);

  useEffect(() => {
    if (!open) return;
    setMid(materialId ?? ""); setDate(todayISO()); setQty(""); setOid(orderId ?? NONE); setNote("");
  }, [open, materialId, orderId]);

  const active = orders.filter((o) => o.stage !== "completed");
  const order = orders.find((o) => o.id === oid);
  const paper = m?.category === "Paper Roll";
  const plan = useMemo(() => {
    if (!order || !paper || !ledger) return null;
    const paperIds = new Set(list.filter((x) => x.category === "Paper Roll").map((x) => x.id));
    const issued = -ledger.filter((s) => s.orderId === order.id && paperIds.has(s.materialId) && s.type === "issue").reduce((a, s) => a + s.qty, 0);
    const needed = Math.round((paperPerBox(order.spec) * order.plannedQty * 1.03) / 1000);
    return { issued, needed };
  }, [order, paper, ledger, list]);

  const q = num(qty);
  const after = m && q > 0 ? m.stock - q : null;
  const valid = !!m && q > 0 && after != null && after >= 0 && !!date;

  const submit = async () => {
    if (!valid || !m) return;
    try {
      await issue.mutateAsync({ materialId: m.id, date, qty: q, orderId: oid === NONE ? undefined : oid, note: note || undefined });
      toast.success(`Issued ${formatQty(q, UNIT_LABEL[m.unit])} of ${m.name}`, { description: order ? `to ${order.orderNo}` : "for general use" });
      onOpenChange(false);
    } catch (e) { toast.error("Couldn't issue material", { description: errMsg(e) }); }
  };
  useHotkeys({ "mod+enter": () => void submit() }, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowUpFromLine className="size-5 text-brand-600" /> Issue to production</DialogTitle>
          <DialogDescription>Material taken from the store for the shop floor. Valued at average cost.</DialogDescription>
        </DialogHeader>
        <FormField label="Material" required>
          <MaterialSelect value={mid} onChange={setMid} disabled={!!materialId} list={list} />
        </FormField>
        {m && <StockLine m={m} label="After issue" after={after} />}
        <div className="grid grid-cols-2 gap-4">
          <FormField label={`Quantity (${m ? UNIT_LABEL[m.unit] : "qty"})`} htmlFor="is-qty" required error={after != null && after < 0 ? "More than available stock" : undefined}>
            <Input id="is-qty" type="number" min="0" step="0.01" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} className="font-semibold" aria-invalid={after != null && after < 0} />
          </FormField>
          <FormField label="Date" htmlFor="is-date" required>
            <Input id="is-date" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Production order" hint="Links consumption to the job for paper-usage tracking">
          <Select value={oid} onValueChange={setOid}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>General use / not linked</SelectItem>
              {active.map((o) => <SelectItem key={o.id} value={o.id}>{o.orderNo} · {o.customer} · {o.product}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        {plan && (
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-sm tabular">
            <div><div className="text-xs text-muted-foreground">Paper needed (est.)</div><div className="font-semibold">{formatQty(plan.needed, "kg")}</div></div>
            <div><div className="text-xs text-muted-foreground">Issued so far</div><div className="font-semibold">{formatQty(plan.issued, "kg")}</div></div>
            <div><div className="text-xs text-muted-foreground">After this issue</div><div className={cn("font-semibold", plan.issued + (q || 0) > plan.needed && "text-warning-foreground")}>{formatQty(plan.issued + (q > 0 ? q : 0), "kg")}</div></div>
          </div>
        )}
        <FormField label="Note" htmlFor="is-note">
          <Input id="is-note" placeholder="Machine, shift, reel no.…" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} loading={issue.isPending} onClick={submit}>Issue material</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Stock adjustment ───────── */
export function AdjustDialog({ open, materialId, onOpenChange }: { open: boolean; materialId?: string; onOpenChange: (v: boolean) => void }) {
  const { data: list = [] } = useMaterials();
  const adjust = useStockAdjust();
  const [mid, setMid] = useState("");
  const [count, setCount] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>("stock_count");
  const [note, setNote] = useState("");
  const m = list.find((x) => x.id === mid);
  useEffect(() => { if (open) { setMid(materialId ?? ""); setCount(""); setReason("stock_count"); setNote(""); } }, [open, materialId]);

  const c = num(count);
  const diff = m && c >= 0 ? c - m.stock : null;
  const valid = !!m && c >= 0 && diff !== 0 && (reason !== "other" || note.trim().length > 2);

  const submit = async () => {
    if (!valid || !m) return;
    try {
      await adjust.mutateAsync({ materialId: m.id, date: todayISO(), newStock: c, reason, note: note || undefined });
      toast.success(`${m.name} adjusted to ${formatQty(c, UNIT_LABEL[m.unit])}`);
      onOpenChange(false);
    } catch (e) { toast.error("Couldn't adjust stock", { description: errMsg(e) }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scale className="size-5 text-muted-foreground" /> Adjust stock</DialogTitle>
          <DialogDescription>Correct the system balance to match a physical count or record a loss.</DialogDescription>
        </DialogHeader>
        <FormField label="Material" required><MaterialSelect value={mid} onChange={setMid} disabled={!!materialId} list={list} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={`Counted stock (${m ? UNIT_LABEL[m.unit] : "qty"})`} htmlFor="adj-count" required>
            <Input id="adj-count" type="number" min="0" step="0.01" autoFocus value={count} onChange={(e) => setCount(e.target.value)} className="font-semibold" />
          </FormField>
          <FormField label="Reason" required>
            <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ADJUST_REASONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
        </div>
        {m && diff != null && (
          <p className={cn("rounded-lg px-3 py-2 text-sm tabular", diff < 0 ? "bg-danger-soft text-danger-foreground" : diff > 0 ? "bg-success-soft text-success-foreground" : "bg-muted text-muted-foreground")}>
            System {formatQty(m.stock, UNIT_LABEL[m.unit])} → counted {formatQty(c, UNIT_LABEL[m.unit])}:{" "}
            <b>{diff > 0 ? "+" : ""}{formatQty(diff, UNIT_LABEL[m.unit])}</b> ({formatINR(Math.round(diff * m.avgCost), { sign: true })})
          </p>
        )}
        <FormField label="Note" htmlFor="adj-note" required={reason === "other"}>
          <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} loading={adjust.isPending} onClick={submit}>Save adjustment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
