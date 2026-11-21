import { useState } from "react";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PrintPortal } from "@/components/shared/PrintPortal";
import type { PayrollLine, SalaryPayment } from "@/types/domain";
import { periodLabel } from "../api";
import { SalarySlip, SlipPages } from "./SalarySlip";

export interface SlipJob {
  period: string;
  workingDays: number;
  lines: PayrollLine[];
  payments: Map<string, SalaryPayment>;
}

/** On-screen preview of one or many slips, with a Print button. */
export function SlipPreviewDialog({ job, onOpenChange }: { job: SlipJob | null; onOpenChange: (v: boolean) => void }) {
  const [printing, setPrinting] = useState(false);
  if (!job) return null;
  const slips = job.lines.map((l) => (
    <SalarySlip key={l.workerId} period={job.period} line={l} workingDays={job.workingDays} payment={l.paymentId ? job.payments.get(l.paymentId) : undefined} />
  ));
  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader className="flex-row items-center justify-between pr-8">
          <div>
            <DialogTitle>Salary slip{job.lines.length > 1 ? `s (${job.lines.length})` : `: ${job.lines[0]?.name}`}</DialogTitle>
            <DialogDescription>{periodLabel(job.period)} · prints two slips per A4 page</DialogDescription>
          </div>
          <Button onClick={() => setPrinting(true)} loading={printing}><Printer /> Print</Button>
        </DialogHeader>
        <div className="-mx-6 overflow-y-auto bg-muted px-6 py-4">
          <div className="flex flex-col gap-4">{slips}</div>
        </div>
        {printing && <PrintPortal onDone={() => setPrinting(false)}><SlipPages>{slips}</SlipPages></PrintPortal>}
      </DialogContent>
    </Dialog>
  );
}
