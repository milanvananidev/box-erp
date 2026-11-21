import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";

const QUICK = ["Waiting for artwork approval", "Paper not in stock", "Machine breakdown", "Customer asked to pause", "Payment pending"];

export function HoldDialog({ open, onOpenChange, onConfirm, busy }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (reason: string) => void; busy?: boolean }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Put order on hold</DialogTitle>
          <DialogDescription>The order keeps its progress and returns to the same stage when you resume it.</DialogDescription>
        </DialogHeader>
        <FormField label="Reason" htmlFor="hold-reason" required>
          <Textarea id="hold-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </FormField>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setReason(q)} className="rounded-full border border-border px-2.5 py-1 text-xs text-[#475467] hover:border-brand-300 hover:bg-brand-50">
              {q}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={reason.trim().length < 3} loading={busy} onClick={() => onConfirm(reason.trim())}>Put on hold</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
