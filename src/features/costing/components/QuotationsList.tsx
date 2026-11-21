import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Search, Eye, Trash2, Copy, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { formatRupees } from "@/lib/format";
import {
  useQuotations,
  useDeleteQuotation,
  type IQuotation,
  type CorrugatedBoxInput,
} from "../api";
import { QuotationViewDialog } from "./QuotationViewDialog";

export function QuotationsList({
  onCloneToStudio,
  onCreateNew,
}: {
  onCloneToStudio?: (box: CorrugatedBoxInput) => void;
  onCreateNew?: () => void;
}) {
  const { data: quotations, isLoading, error, refetch } = useQuotations();
  const deleteMutation = useDeleteQuotation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedQuotation, setSelectedQuotation] = useState<IQuotation | null>(null);
  const [toDelete, setToDelete] = useState<IQuotation | null>(null);

  const filtered = (quotations || []).filter((q) => {
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.clientName.toLowerCase().includes(search.toLowerCase()) ||
      (q.boxName || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      toast.success("Quotation deleted");
      setToDelete(null);
    } catch (e) {
      toast.error("Failed to delete quotation", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const getStatusBadgeTone = (status: string) => {
    switch (status) {
      case "APPROVED": return "success";
      case "SENT": return "brand";
      case "DECLINED": return "danger";
      default: return "neutral";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotation #, client, or box..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-subtle p-0.5 text-xs">
            {["ALL", "DRAFT", "SENT", "APPROVED"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
                  statusFilter === status
                    ? "bg-card text-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {onCreateNew && (
            <Button size="sm" onClick={onCreateNew}>
              <Plus className="size-3.5" /> New Costing
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading quotations...</div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No quotations found"
              description="Calculate a box price in the Costing Studio and save it as a quotation."
              action={onCreateNew && <Button size="sm" onClick={onCreateNew}><Plus /> Create Estimate</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4">Quote #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Box Specifications</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4 text-right">Rate / Box</th>
                    <th className="py-2.5 px-4 text-right">Total Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((q) => (
                    <tr key={q.id} className="hover:bg-subtle/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-brand-700">
                        {q.quotationNumber}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {q.date ? format(parseISO(q.date), "dd MMM yyyy") : "-"}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {q.clientName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">{q.boxName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {q.input.lengthMm} × {q.input.widthMm} × {q.input.heightMm} mm ({q.input.ply}-Ply)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {q.quantity.toLocaleString("en-IN")} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatRupees(q.basicPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatRupees(q.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge tone={getStatusBadgeTone(q.status)} size="sm">
                          {q.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setSelectedQuotation(q)}
                            title="View / Print Quotation"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          {onCloneToStudio && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => onCloneToStudio(q.input)}
                              title="Load into Costing Studio"
                            >
                              <Copy className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-danger hover:text-danger hover:bg-danger-soft"
                            onClick={() => setToDelete(q)}
                            title="Delete Quotation"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View / Print Quotation Dialog */}
      <QuotationViewDialog
        quotation={selectedQuotation}
        open={!!selectedQuotation}
        onOpenChange={(v) => !v && setSelectedQuotation(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete Quotation?"
        description={
          toDelete && (
            <>
              Are you sure you want to delete quotation{" "}
              <b>{toDelete.quotationNumber}</b> for <b>{toDelete.clientName}</b>? This action cannot be undone.
            </>
          )
        }
        confirmLabel="Delete Quotation"
        onConfirm={handleDelete}
      />
    </div>
  );
}
