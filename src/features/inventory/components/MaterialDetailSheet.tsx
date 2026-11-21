import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Scale, Trash2 } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Hint } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/shared/states";
import { formatDate, formatINR, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockMovement } from "@/types/domain";
import { UNIT_LABEL, useDeleteMovement, useMovements, type MaterialRow } from "../api";
import { MovementBadge, movementDetail } from "./MovementBits";
import { StockStatusBadge } from "./StockStatus";

export function MaterialDetailSheet({
  material: m, onClose, onInward, onIssue, onAdjust, onEdit,
}: { material: MaterialRow | undefined; onClose: () => void; onInward: () => void; onIssue: () => void; onAdjust: () => void; onEdit: () => void }) {
  const ledger = useMovements(m?.id, !!m);
  const del = useDeleteMovement();
  const [toDelete, setToDelete] = useState<StockMovement | null>(null);
  const unit = m ? UNIT_LABEL[m.unit] : "";
  const pct = m && m.reorderLevel ? Math.min(100, (m.stock / (m.reorderLevel * 2)) * 100) : 100;

  return (
    <Sheet open={!!m} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width="lg">
        {m && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2.5">
                <SheetTitle>{m.name}</SheetTitle>
                <StockStatusBadge status={m.status} />
              </div>
              <SheetDescription>
                {m.code} · {m.category}
                {m.gsm ? ` · ${m.gsm} GSM` : ""}{m.bf ? ` · ${m.bf} BF` : ""}{m.deckleInch ? ` · ${m.deckleInch}" deckle` : ""}
              </SheetDescription>
              <div className="mt-3 flex gap-2">
                <Button onClick={onInward}><ArrowDownToLine /> Inward</Button>
                <Button variant="outline" onClick={onIssue} disabled={m.stock <= 0}><ArrowUpFromLine /> Issue</Button>
                <Button variant="outline" onClick={onAdjust}><Scale /> Adjust</Button>
                <Button variant="ghost" className="ml-auto" onClick={onEdit}><Pencil /> Edit</Button>
              </div>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <section className="grid grid-cols-4 gap-3">
                {[
                  ["In stock", formatQty(m.stock, unit)],
                  ["Reorder at", formatQty(m.reorderLevel, unit)],
                  ["Avg cost", `${formatINR(m.avgCost, { precise: true })}/${m.unit}`],
                  ["Stock value", formatINR(m.value)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border p-3.5">
                    <div className="text-xs text-muted-foreground">{k}</div>
                    <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
                  </div>
                ))}
              </section>
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", m.status === "ok" ? "bg-success" : m.status === "low" ? "bg-warning" : "bg-danger")} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground tabular">Issued this month: {formatQty(m.issuedThisMonth, unit)}{m.lastInward && ` · last inward ${formatDate(m.lastInward)}`}</p>
              </div>

              <section className="space-y-3">
                <h3 className="font-semibold">Stock ledger</h3>
                {ledger.error ? (
                  <ErrorState compact error={ledger.error} onRetry={() => ledger.refetch()} />
                ) : ledger.isLoading ? (
                  <RowsSkeleton rows={5} />
                ) : !ledger.data?.length ? (
                  <EmptyState compact title="No stock movements yet" description="Record an inward to bring this material into stock." />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead className="text-right">In</TableHead>
                          <TableHead className="text-right">Out</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.data.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-[#475467]">{formatDate(s.date)}</TableCell>
                            <TableCell><MovementBadge type={s.type} /></TableCell>
                            <TableCell className="max-w-56 truncate text-[13px] text-muted-foreground">{movementDetail(s)}</TableCell>
                            <TableCell className="text-right font-medium text-success-foreground">{s.qty > 0 ? formatQty(s.qty) : ""}</TableCell>
                            <TableCell className="text-right font-medium">{s.qty < 0 ? formatQty(-s.qty) : ""}</TableCell>
                            <TableCell className="text-right">{formatQty(s.balanceAfter)}</TableCell>
                            <TableCell>
                              {s.type !== "opening" && (
                                <Hint label="Delete entry">
                                  <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => setToDelete(s)}><Trash2 /></Button>
                                </Hint>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            </SheetBody>
            <ConfirmDialog
              open={!!toDelete}
              onOpenChange={(v) => !v && setToDelete(null)}
              title="Delete this stock entry?"
              description={toDelete && (
                <>
                  {toDelete.type === "inward" ? "Inward" : toDelete.type === "issue" ? "Issue" : "Adjustment"} of {formatQty(Math.abs(toDelete.qty), unit)} on {formatDate(toDelete.date)}.
                  {" "}Balances and average cost are recalculated.{toDelete.transactionId && " The linked cash-book payment is removed too."}
                </>
              )}
              onConfirm={async () => {
                if (!toDelete) return;
                try { await del.mutateAsync(toDelete.id); toast.success("Entry deleted"); }
                catch (e) { toast.error("Couldn't delete", { description: e instanceof Error ? e.message : undefined }); throw e; }
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
