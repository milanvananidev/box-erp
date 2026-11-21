import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { formatINR, formatQty, toPaise, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useParties } from "@/features/finance/api";
import type { AdjustmentReason, PaymentMode } from "@/types/domain";
import { ADJUST_REASONS, UNIT_LABEL, useMaterials, useStockAdjust, useStockInward, useStockIssue, type MaterialRow } from "../api";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : undefined);
const NONE = "__none";

function MaterialSelect({
  value,
  onChange,
  disabled,
  list,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  list: MaterialRow[];
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="font-medium text-foreground">
        <SelectValue placeholder="Select raw material or paper reel" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {list
          .filter((m) => m.active)
          .map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <div className="flex items-center justify-between gap-4 w-full">
                <span>{m.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  Stock: {formatQty(m.stock, UNIT_LABEL[m.unit])}
                </span>
              </div>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function StockPreviewCard({
  m,
  after,
  label,
}: {
  m: MaterialRow;
  after: number | null;
  label: string;
}) {
  const isNegative = after != null && after < 0;
  const isLow = after != null && after <= m.reorderLevel;

  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl bg-subtle/80 border border-border p-3.5 text-sm tabular">
      <div>
        <div className="text-xs text-muted-foreground">Current Stock</div>
        <div className="text-base font-bold text-foreground font-mono">
          {formatQty(m.stock, UNIT_LABEL[m.unit])}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            "text-base font-bold font-mono",
            isNegative ? "text-danger" : isLow ? "text-warning-foreground" : "text-success",
          )}
        >
          {after == null ? "—" : formatQty(after, UNIT_LABEL[m.unit])}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Valuation Rate</div>
        <div className="text-base font-bold text-foreground font-mono">
          {formatINR(m.avgCost, { precise: true })}/{m.unit}
        </div>
      </div>
    </div>
  );
}

/* ───────── 1. Stock In (Purchase / Goods Received) ───────── */
export function InwardDialog({
  open,
  materialId,
  onOpenChange,
}: {
  open: boolean;
  materialId?: string;
  onOpenChange: (v: boolean) => void;
}) {
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
    setMid(materialId ?? "");
    setDate(todayISO());
    setQty("");
    setBill("");
    setReels("");
    setPayNow(false);
    setMode("bank");
  }, [open, materialId]);

  useEffect(() => {
    if (m) {
      setRate(m.avgCost ? String(fromPaise(m.avgCost)) : "");
      setVendor(m.preferredVendorId ?? NONE);
    }
  }, [m?.id]);

  const q = num(qty);
  const r = num(rate);
  const totalPaise = q > 0 && r > 0 ? Math.round(q * toPaise(r)) : 0;
  const valid = !!m && q > 0 && r > 0 && !!date && (!payNow || vendor !== NONE);

  const submit = async () => {
    if (!valid || !m) return;
    try {
      await inward.mutateAsync({
        materialId: m.id,
        date,
        qty: q,
        rate: toPaise(r),
        vendorId: vendor === NONE ? undefined : vendor,
        billNo: bill || undefined,
        reels: reels ? Math.floor(num(reels)) : undefined,
        payNow: payNow ? { mode } : undefined,
      });
      toast.success(`Received ${formatQty(q, UNIT_LABEL[m.unit])} of ${m.name}`, {
        description: payNow
          ? `Expense payment of ${formatINR(totalPaise)} recorded in cash book`
          : "Stock quantity and average cost updated in godown",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't record inward", { description: errMsg(e) });
    }
  };

  useHotkeys({ "mod+enter": () => void submit() }, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownToLine className="size-4" />
            </span>
            Add Stock In (Goods Received)
          </DialogTitle>
          <DialogDescription>
            Record paper reels, gum, ink, or consumables delivered to the factory godown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <FormField label="Select Material" required>
            <MaterialSelect value={mid} onChange={setMid} disabled={!!materialId} list={list} />
          </FormField>

          {m && <StockPreviewCard m={m} label="Stock After Inward" after={q > 0 ? m.stock + q : null} />}

          {/* Quantity & Rate */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label={`Quantity (${m ? UNIT_LABEL[m.unit] : "qty"})`} htmlFor="in-qty" required>
              <Input
                id="in-qty"
                type="number"
                min="0"
                step="any"
                autoFocus
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="font-mono text-base font-bold"
              />
            </FormField>

            <FormField label={`Purchase Rate (₹/${m?.unit ?? "unit"})`} htmlFor="in-rate" required>
              <CurrencyInput
                id="in-rate"
                placeholder="0.00"
                value={rate ? Number(rate) : undefined}
                onChange={(val) => setRate(val !== undefined ? String(val) : "")}
                className="font-mono text-base"
              />
            </FormField>

            <FormField label="Received Date" htmlFor="in-date" required>
              <Input
                id="in-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormField>
          </div>

          {/* Highlighted Total Purchase Value */}
          {totalPaise > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 border border-emerald-200/80 px-4 py-2.5">
              <span className="text-xs font-semibold text-emerald-900">Total Purchase Value</span>
              <span className="text-lg font-bold font-mono text-emerald-700">{formatINR(totalPaise)}</span>
            </div>
          )}

          {/* Vendor & Invoice */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Supplier / Vendor" className="col-span-2" required={payNow}>
              <Select value={vendor} onValueChange={setVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified / Cash purchase</SelectItem>
                  {parties
                    .filter((p) => p.type === "vendor")
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Challan / Bill No." htmlFor="in-bill">
              <Input id="in-bill" placeholder="e.g. 1042" value={bill} onChange={(e) => setBill(e.target.value)} />
            </FormField>
          </div>

          {m?.category === "Paper Roll" && (
            <div className="w-1/2">
              <FormField label="Number of Reels" htmlFor="in-reels" hint="Optional, for godown roll count">
                <Input
                  id="in-reels"
                  type="number"
                  min="0"
                  placeholder="e.g. 4"
                  value={reels}
                  onChange={(e) => setReels(e.target.value)}
                />
              </FormField>
            </div>
          )}

          {/* Payment Sync with Cash Book */}
          <div className="rounded-xl border border-border p-3 space-y-2 bg-card">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={payNow}
                onChange={(e) => setPayNow(e.target.checked)}
                className="size-4 rounded accent-brand-600"
              />
              <span>Paid immediately? Record {formatINR(totalPaise)} in cash book now.</span>
            </label>
            {payNow && (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-muted-foreground">Payment Mode:</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-input p-0.5 w-60">
                  {(["cash", "bank", "upi"] as const).map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setMode(x)}
                      className={cn(
                        "rounded-md py-1 text-xs font-semibold transition-colors cursor-pointer",
                        mode === x ? "bg-brand-600 text-white" : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {x === "upi" ? "UPI" : x[0]!.toUpperCase() + x.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={inward.isPending} onClick={submit} className="bg-emerald-600 hover:bg-emerald-700">
            Confirm Stock In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── 2. Stock Out (Usage / Issue) ───────── */
export function IssueDialog({
  open,
  materialId,
  onOpenChange,
}: {
  open: boolean;
  materialId?: string;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: list = [] } = useMaterials();
  const issue = useStockIssue();

  const [mid, setMid] = useState("");
  const [date, setDate] = useState(todayISO());
  const [qty, setQty] = useState("");
  const [purpose, setPurpose] = useState("Corrugation & Pasting");
  const [note, setNote] = useState("");

  const m = list.find((x) => x.id === mid);

  useEffect(() => {
    if (!open) return;
    setMid(materialId ?? "");
    setDate(todayISO());
    setQty("");
    setPurpose("Corrugation & Pasting");
    setNote("");
  }, [open, materialId]);

  const q = num(qty);
  const after = m && q > 0 ? m.stock - q : null;
  const isOverStock = after != null && after < 0;
  const valid = !!m && q > 0 && !isOverStock && !!date;

  const submit = async () => {
    if (!valid || !m) return;
    try {
      const fullNote = [purpose, note.trim()].filter(Boolean).join(" · ");
      await issue.mutateAsync({
        materialId: m.id,
        date,
        qty: q,
        note: fullNote || undefined,
      });
      toast.success(`Recorded usage: ${formatQty(q, UNIT_LABEL[m.unit])} of ${m.name}`, {
        description: `Issued for ${purpose}. Remaining godown stock: ${formatQty(m.stock - q, UNIT_LABEL[m.unit])}`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't record usage", { description: errMsg(e) });
    }
  };

  useHotkeys({ "mod+enter": () => void submit() }, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ArrowUpFromLine className="size-4 text-[#C98F4F]" />
            </span>
            Record Stock Out (Material Usage)
          </DialogTitle>
          <DialogDescription>
            Record paper reels mounted on machines, or gum and ink consumed on the factory floor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <FormField label="Select Material" required>
            <MaterialSelect value={mid} onChange={setMid} disabled={!!materialId} list={list} />
          </FormField>

          {m && <StockPreviewCard m={m} label="Remaining After Usage" after={after} />}

          {/* Quantity & Date */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={`Quantity Used (${m ? UNIT_LABEL[m.unit] : "qty"})`}
              htmlFor="is-qty"
              required
              error={isOverStock ? `Cannot exceed current stock (${formatQty(m?.stock ?? 0)})` : undefined}
            >
              <Input
                id="is-qty"
                type="number"
                min="0"
                step="any"
                autoFocus
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={cn("font-mono text-base font-bold", isOverStock && "border-danger text-danger")}
              />
            </FormField>

            <FormField label="Usage Date" htmlFor="is-date" required>
              <Input
                id="is-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormField>
          </div>

          {/* Department / Purpose Presets */}
          <FormField label="Usage Purpose / Section" required>
            <div className="grid grid-cols-3 gap-2">
              {[
                "Corrugation & Pasting",
                "Printing & Ink",
                "Rotary / Creasing",
                "Stitching & Bundling",
                "General Shop Floor",
                "Damaged / Scrap",
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer text-left truncate",
                    purpose === p
                      ? "border-brand-500 bg-brand-50 text-brand-900 font-semibold"
                      : "border-border text-muted-foreground hover:bg-subtle",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </FormField>

          {/* Optional Details / Note */}
          <FormField label="Additional Note (Optional)" htmlFor="is-note" hint="e.g. Shift 1, Operator name, Reel #">
            <Input
              id="is-note"
              placeholder="e.g. 5-Ply box job run, Corrugator 1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={issue.isPending}
            onClick={submit}
            className="bg-[#C98F4F] hover:bg-[#B37A3B] text-white"
          >
            Confirm Stock Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── 3. Stock Adjustment (Physical Count) ───────── */
export function AdjustDialog({
  open,
  materialId,
  onOpenChange,
}: {
  open: boolean;
  materialId?: string;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: list = [] } = useMaterials();
  const adjust = useStockAdjust();

  const [mid, setMid] = useState("");
  const [count, setCount] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>("stock_count");
  const [note, setNote] = useState("");

  const m = list.find((x) => x.id === mid);

  useEffect(() => {
    if (open) {
      setMid(materialId ?? "");
      setCount("");
      setReason("stock_count");
      setNote("");
    }
  }, [open, materialId]);

  const c = num(count);
  const diff = m && c >= 0 ? c - m.stock : null;
  const valid = !!m && c >= 0 && diff !== 0 && (reason !== "other" || note.trim().length > 2);

  const submit = async () => {
    if (!valid || !m) return;
    try {
      await adjust.mutateAsync({
        materialId: m.id,
        date: todayISO(),
        newStock: c,
        reason,
        note: note || undefined,
      });
      toast.success(`${m.name} stock adjusted to ${formatQty(c, UNIT_LABEL[m.unit])}`, {
        description: `Variance of ${diff! > 0 ? "+" : ""}${formatQty(diff!, UNIT_LABEL[m.unit])} saved to ledger.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't adjust stock", { description: errMsg(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Scale className="size-4" />
            </span>
            Stock Adjustment (Physical Count)
          </DialogTitle>
          <DialogDescription>
            Correct the system inventory to match the real physical count found in the godown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <FormField label="Select Material" required>
            <MaterialSelect value={mid} onChange={setMid} disabled={!!materialId} list={list} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={`Physical Count (${m ? UNIT_LABEL[m.unit] : "qty"})`}
              htmlFor="adj-count"
              required
            >
              <Input
                id="adj-count"
                type="number"
                min="0"
                step="any"
                autoFocus
                placeholder={m ? String(m.stock) : "0"}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="font-mono text-base font-bold"
              />
            </FormField>

            <FormField label="Adjustment Reason" required>
              <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADJUST_REASONS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Difference Summary */}
          {m && diff != null && (
            <div
              className={cn(
                "flex items-center justify-between rounded-xl p-3 text-sm font-medium border",
                diff < 0
                  ? "bg-rose-50/70 text-rose-800 border-rose-200"
                  : diff > 0
                  ? "bg-emerald-50/70 text-emerald-800 border-emerald-200"
                  : "bg-muted text-muted-foreground border-border",
              )}
            >
              <div>
                <span className="text-xs opacity-75">Variance: </span>
                <span className="font-mono font-bold">
                  {diff > 0 ? `+${formatQty(diff, UNIT_LABEL[m.unit])}` : formatQty(diff, UNIT_LABEL[m.unit])}
                </span>
              </div>
              <div className="text-xs font-mono">
                System: {formatQty(m.stock)} → New: {formatQty(c)}
              </div>
            </div>
          )}

          <FormField label="Reason Details / Note" htmlFor="adj-note" required={reason === "other"}>
            <Input
              id="adj-note"
              placeholder="e.g. Month-end godown audit by factory manager"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={adjust.isPending} onClick={submit}>
            Update Stock Balance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
