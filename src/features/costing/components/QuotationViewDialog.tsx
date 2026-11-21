import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Printer, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrintPortal } from "@/components/shared/PrintPortal";
import { useCompany } from "@/lib/company";
import type { IQuotation } from "../api";

export function QuotationViewDialog({
  quotation,
  open,
  onOpenChange,
}: {
  quotation: IQuotation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const company = useCompany();
  const [printing, setPrinting] = useState(false);

  if (!quotation) return null;

  const handleCopyWhatsApp = () => {
    const summaryText = `📦 *QUOTATION - ${quotation.quotationNumber}*
*${company.name}*

Client: ${quotation.clientName}
Product: ${quotation.boxName} (${quotation.input.lengthMm}×${quotation.input.widthMm}×${quotation.input.heightMm} mm, ${quotation.input.ply}-Ply)
Order Quantity: ${quotation.quantity.toLocaleString("en-IN")} pcs
Rate per Box: ₹${quotation.basicPrice.toFixed(2)}
GST (${quotation.taxPercent}%): ₹${(quotation.basicPrice * quotation.taxPercent / 100).toFixed(2)}
Total per Box: ₹${(quotation.basicPrice * (1 + quotation.taxPercent / 100)).toFixed(2)}
*Grand Total: ₹${quotation.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*

For any queries, please call: ${company.phone}`;

    navigator.clipboard.writeText(summaryText);
    toast.success("Quotation summary copied to clipboard for WhatsApp!");
  };

  const formattedDate = quotation.date
    ? format(parseISO(quotation.date), "dd MMMM yyyy")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-3 flex-row items-center justify-between pr-8">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <span>{quotation.quotationNumber}</span>
              <Badge tone="neutral" size="sm">{quotation.status}</Badge>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Client: <b>{quotation.clientName}</b> · Generated on {formattedDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyWhatsApp}>
              <Copy className="size-3.5" /> WhatsApp
            </Button>
            <Button size="sm" onClick={() => setPrinting(true)}>
              <Printer className="size-3.5" /> Print
            </Button>
          </div>
        </DialogHeader>

        {/* Quotation Formal Letter Content */}
        <div className="p-4 space-y-6 text-xs font-sans text-foreground">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold uppercase text-brand-700">{company.name}</h2>
              <p className="text-muted-foreground mt-0.5">{company.address}</p>
              {company.gstin && <p className="text-muted-foreground">GSTIN: {company.gstin}</p>}
              {company.phone && <p className="text-muted-foreground">Phone: {company.phone}</p>}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tracking-tight">PROFORMA ESTIMATE</div>
              <div className="font-mono text-muted-foreground mt-1">Ref: {quotation.quotationNumber}</div>
              <div className="text-muted-foreground">Date: {formattedDate}</div>
            </div>
          </div>

          {/* Client Details */}
          <div className="rounded-xl border border-border bg-subtle p-3 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Quotation For</span>
              <div className="font-semibold text-sm mt-0.5">{quotation.clientName}</div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Delivery / Validity</span>
              <div className="text-muted-foreground mt-0.5">Valid for 15 days from date of issue</div>
            </div>
          </div>

          {/* Item Specification Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-subtle border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Description & Specifications</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-sm">{quotation.boxName}</div>
                    <div className="text-muted-foreground mt-1 space-y-0.5 font-mono text-[11px]">
                      <div>
                        Dimensions: <b>{quotation.input.lengthMm} × {quotation.input.widthMm} × {quotation.input.heightMm} mm</b> ({quotation.input.ply}-Ply)
                      </div>
                      <div>
                        Sheet Size: {quotation.result.sheetLengthInch}&quot; × {quotation.result.sheetWidthInch}&quot; · Est. BS: {quotation.result.totalBs} kg/cm²
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium">
                    {quotation.quantity.toLocaleString("en-IN")} pcs
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium">
                    ₹{quotation.basicPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    ₹{(quotation.basicPrice * quotation.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-subtle/50 font-semibold border-t border-border">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right text-muted-foreground">Subtotal (Basic)</td>
                  <td className="py-2 px-3 text-right font-mono">
                    ₹{(quotation.basicPrice * quotation.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right text-muted-foreground">GST ({quotation.taxPercent}%)</td>
                  <td className="py-2 px-3 text-right font-mono">
                    ₹{(quotation.basicPrice * quotation.quantity * quotation.taxPercent / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="border-t border-border text-sm font-bold text-brand-700">
                  <td colSpan={3} className="py-2.5 px-3 text-right">Total Net Amount</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    ₹{quotation.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terms & Conditions */}
          <div className="rounded-xl border border-border p-3 space-y-1.5 text-[11px] text-muted-foreground">
            <div className="font-semibold text-foreground">Standard Terms & Conditions:</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Rates are Ex-Factory Gujarat. Freight & unloading as applicable.</li>
              <li>Dimensional tolerance: &plusmn; 2 mm as per standard packaging norms.</li>
              <li>Delivery within 7 to 10 working days upon formal purchase order.</li>
              <li>Payment terms: 30 days from dispatch against invoice.</li>
            </ul>
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-end items-center pt-2">
            <div className="text-right text-[11px] text-muted-foreground">
              Authorized Signature: _________________________
            </div>
          </div>
        </div>

        {/* Print Layout */}
        {printing && (
          <PrintPortal onDone={() => setPrinting(false)}>
            <div className="p-8 font-sans text-xs text-black space-y-6">
              <div className="flex justify-between items-start border-b border-black pb-4">
                <div>
                  <h2 className="text-lg font-bold uppercase">{company.name}</h2>
                  <p>{company.address}</p>
                  {company.gstin && <p>GSTIN: {company.gstin}</p>}
                  {company.phone && <p>Phone: {company.phone}</p>}
                </div>
                <div className="text-right">
                  <div className="text-base font-bold">PROFORMA ESTIMATE</div>
                  <div className="font-mono">Ref: {quotation.quotationNumber}</div>
                  <div>Date: {formattedDate}</div>
                </div>
              </div>

              <div className="border border-black p-3 grid grid-cols-2 gap-4">
                <div>
                  <span className="font-bold">Quotation For:</span>
                  <div className="text-sm font-semibold">{quotation.clientName}</div>
                </div>
                <div>
                  <span className="font-bold">Validity:</span>
                  <div>Valid for 15 days from date of issue</div>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="border-b border-black bg-zinc-100">
                    <th className="border-r border-black p-2 text-left">Description</th>
                    <th className="border-r border-black p-2 text-right">Quantity</th>
                    <th className="border-r border-black p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-r border-black p-2">
                      <div className="font-bold">{quotation.boxName}</div>
                      <div>{quotation.input.lengthMm} × {quotation.input.widthMm} × {quotation.input.heightMm} mm ({quotation.input.ply}-Ply)</div>
                      <div>Sheet: {quotation.result.sheetLengthInch}&quot; × {quotation.result.sheetWidthInch}&quot;</div>
                    </td>
                    <td className="border-r border-black p-2 text-right font-mono">{quotation.quantity} pcs</td>
                    <td className="border-r border-black p-2 text-right font-mono">₹{quotation.basicPrice.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono font-bold">
                      ₹{(quotation.basicPrice * quotation.quantity).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-black font-semibold">
                    <td colSpan={3} className="border-r border-black p-2 text-right">GST ({quotation.taxPercent}%)</td>
                    <td className="p-2 text-right font-mono">
                      ₹{(quotation.basicPrice * quotation.quantity * quotation.taxPercent / 100).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-t border-black font-bold">
                    <td colSpan={3} className="border-r border-black p-2 text-right">Total Amount</td>
                    <td className="p-2 text-right font-mono">₹{quotation.totalAmount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="border border-black p-3 space-y-1 text-[11px]">
                <div className="font-bold">Standard Terms:</div>
                <div>1. Rates are Ex-Factory. Delivery within 7 to 10 working days.</div>
                <div>2. Dimensional tolerance &plusmn; 2 mm as per standard industry specifications.</div>
              </div>

              <div className="pt-8 flex justify-between">
                <div>Client Confirmation: _____________________</div>
                <div>Authorized Signatory: _____________________</div>
              </div>
            </div>
          </PrintPortal>
        )}
      </DialogContent>
    </Dialog>
  );
}
