import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Scale, Trash2 } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  material: m,
  onClose,
  onInward,
  onIssue,
  onAdjust,
  onEdit,
}: {
  material: MaterialRow | undefined;
  onClose: () => void;
  onInward: () => void;
  onIssue: () => void;
  onAdjust: () => void;
  onEdit: () => void;
}) {
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
            <SheetHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <SheetTitle className="text-xl font-bold">{m.name}</SheetTitle>
                  <StockStatusBadge status={m.status} />
                </div>
                <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs">
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="font-mono bg-subtle px-2 py-0.5 rounded border border-border">{m.code}</span>
                <span>•</span>
                <span>{m.category}</span>
                {m.gsm && (
                  <span className="bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200">
                    {m.gsm} GSM
                  </span>
                )}
                {m.bf && (
                  <span className="bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200">
                    {m.bf} BF
                  </span>
                )}
                {m.deckleInch && (
                  <span className="bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200">
                    {m.deckleInch}" Deckle
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center gap-2.5">
                <Button onClick={onInward} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                  <ArrowDownToLine className="size-3.5" /> + Stock In
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onIssue}
                  disabled={m.stock <= 0}
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 font-medium"
                >
                  <ArrowUpFromLine className="size-3.5 text-[#C98F4F]" /> - Stock Out
                </Button>
                <Button variant="outline" size="sm" onClick={onAdjust} className="text-xs">
                  <Scale className="size-3.5" /> Adjust Count
                </Button>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-6 pt-5">
              {/* Stat Cards */}
              <section className="grid grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <div className="text-xs text-muted-foreground">In Stock</div>
                  <div className="mt-1 text-lg font-bold font-mono text-foreground">{formatQty(m.stock, unit)}</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <div className="text-xs text-muted-foreground">Reorder Alert</div>
                  <div className="mt-1 text-lg font-bold font-mono text-muted-foreground">{formatQty(m.reorderLevel, unit)}</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <div className="text-xs text-muted-foreground">Avg Cost</div>
                  <div className="mt-1 text-lg font-bold font-mono text-foreground">
                    {formatINR(m.avgCost, { precise: true })}/{m.unit}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <div className="text-xs text-muted-foreground">Total Value</div>
                  <div className="mt-1 text-lg font-bold font-mono text-brand-700">{formatINR(m.value)}</div>
                </div>
              </section>

              {/* Health progress bar */}
              <div className="rounded-xl border border-border/70 bg-subtle/50 p-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Stock Health vs Reorder Level ({formatQty(m.reorderLevel, unit)})</span>
                  <span className="font-mono font-medium">{Math.round(pct)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      m.status === "ok" ? "bg-emerald-500" : m.status === "low" ? "bg-amber-500" : "bg-rose-500",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Issued this month: {formatQty(m.issuedThisMonth, unit)}
                  {m.lastInward ? ` • Last received: ${formatDate(m.lastInward)}` : ""}
                </p>
              </div>

              {/* Ledger Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Stock Movement History</h3>
                  <span className="text-xs text-muted-foreground">{ledger.data?.length ?? 0} entries</span>
                </div>

                {ledger.error ? (
                  <ErrorState compact error={ledger.error} onRetry={() => ledger.refetch()} />
                ) : ledger.isLoading ? (
                  <RowsSkeleton rows={4} />
                ) : !ledger.data?.length ? (
                  <EmptyState compact title="No movements yet" description="Record an inward entry to bring this material into stock." />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent text-xs">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Particulars</TableHead>
                          <TableHead className="text-right">Qty (+ / -)</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="w-10">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.data.map((s) => (
                          <TableRow key={s.id} className="text-xs">
                            <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(s.date)}</TableCell>
                            <TableCell>
                              <MovementBadge type={s.type} />
                            </TableCell>
                            <TableCell className="max-w-48 truncate text-muted-foreground">
                              {movementDetail(s)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-mono font-bold whitespace-nowrap",
                                s.qty > 0 ? "text-emerald-600" : "text-rose-600",
                              )}
                            >
                              {s.qty > 0 ? `+${formatQty(s.qty)}` : formatQty(s.qty)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-foreground font-semibold whitespace-nowrap">
                              {formatQty(s.balanceAfter)}
                            </TableCell>
                            <TableCell>
                              {s.type !== "opening" && (
                                <Hint label="Delete entry">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="size-7 text-muted-foreground hover:text-danger cursor-pointer"
                                    onClick={() => setToDelete(s)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
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
          </>
        )}

        <ConfirmDialog
          open={!!toDelete}
          onOpenChange={(v) => !v && setToDelete(null)}
          title="Delete Stock Entry?"
          description="This will reverse this stock change and recompute the running balance and valuation rate from that day onwards."
          confirmLabel="Delete Entry"
          onConfirm={async () => {
            if (!toDelete) return;
            try {
              await del.mutateAsync(toDelete.id);
              toast.success("Entry removed");
              setToDelete(null);
            } catch (e) {
              toast.error("Couldn't delete entry", {
                description: e instanceof Error ? e.message : undefined,
              });
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
