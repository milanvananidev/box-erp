import { useState } from "react";
import { toast } from "sonner";
import { HandCoins, Pencil, Phone, UserCheck, UserX } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/shared/states";
import { formatDate, formatINR } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import { WAGE_TYPE_LABEL, WAGE_UNIT, useSetWorkerActive, useWorkerHistory, type WorkerRow } from "../api";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : undefined);

export function WorkerDetailSheet({
  worker, onClose, onEdit, onGiveAdvance,
}: { worker: WorkerRow | undefined; onClose: () => void; onEdit: (w: WorkerRow) => void; onGiveAdvance: (w: WorkerRow) => void }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const history = useWorkerHistory(worker?.id);
  const setActive = useSetWorkerActive();
  const w = worker;

  return (
    <Sheet open={!!w} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent width="lg">
        {w && (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-semibold text-white">{initials(w.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <SheetTitle>{w.name}</SheetTitle>
                    {w.active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral">Left {w.leftOn && formatDate(w.leftOn)}</Badge>}
                  </div>
                  <SheetDescription className="mt-0.5">
                    {w.code} · {w.designation}, {w.department} · Joined {formatDate(w.joinedOn)}
                  </SheetDescription>
                  {w.phone && (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#475467]"><Phone className="size-3.5" /> {w.phone}{w.address ? ` · ${w.address}` : ""}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {w.active && <Button onClick={() => onGiveAdvance(w)}><HandCoins /> Give advance</Button>}
                <Button variant="outline" onClick={() => onEdit(w)}><Pencil /> Edit</Button>
                {w.active ? (
                  <Button variant="ghost" className="ml-auto text-danger-foreground hover:bg-danger-soft" onClick={() => setConfirmLeave(true)}><UserX /> Mark as left</Button>
                ) : (
                  <Button variant="outline" className="ml-auto" loading={setActive.isPending} onClick={async () => {
                    try { await setActive.mutateAsync({ id: w.id, active: true }); toast.success(`${w.name} reactivated`); } catch (e) { toast.error("Couldn't reactivate", { description: errMsg(e) }); }
                  }}><UserCheck /> Reactivate</Button>
                )}
              </div>
            </SheetHeader>

            <SheetBody className="space-y-6">
              <section className="grid grid-cols-3 gap-3">
                <Tile label="Wage" value={`${formatINR(w.wageRate, { precise: w.wageType === "piece_rate" })}${WAGE_UNIT[w.wageType]}`} sub={`${WAGE_TYPE_LABEL[w.wageType]} · OT ${formatINR(w.overtimeRatePerHour)}/h`} />
                <Tile label="Advance outstanding" value={formatINR(w.advanceBalance)} sub={w.advanceBalance ? "Deducted in next payroll" : "Nothing to recover"} tone={w.advanceBalance ? "warning" : undefined} />
                <Tile label="Department" value={w.department} sub={w.designation} />
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Payment history</h3>
                {history.error ? (
                  <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
                ) : history.isLoading ? (
                  <RowsSkeleton rows={3} />
                ) : !history.data?.length ? (
                  <EmptyState compact icon={HandCoins} title="No payments yet" description="Salary payouts and advances will appear here." />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.data.map((h) =>
                          h.kind === "salary" ? (
                            <TableRow key={h.item.id}>
                              <TableCell>{formatDate(h.date)}</TableCell>
                              <TableCell><Badge tone="success">Salary</Badge></TableCell>
                              <TableCell className="text-[13px] text-muted-foreground">
                                {h.item.period} · gross {formatINR(h.item.gross)}
                                {h.item.advanceDeduction > 0 && ` − advance ${formatINR(h.item.advanceDeduction)}`} · {h.item.mode.toUpperCase()}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatINR(h.item.net)}</TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={h.item.id}>
                              <TableCell>{formatDate(h.date)}</TableCell>
                              <TableCell><Badge tone="warning">Advance</Badge></TableCell>
                              <TableCell className="text-[13px] text-muted-foreground">
                                {h.item.recovered >= h.item.amount ? "Fully recovered" : h.item.recovered > 0 ? `${formatINR(h.item.recovered)} recovered` : "Outstanding"}
                                {h.item.note && ` · ${h.item.note}`} · {h.item.mode.toUpperCase()}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatINR(h.item.amount)}</TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              {w.notes && <p className="rounded-lg bg-subtle p-3 text-[13px] text-[#475467]">{w.notes}</p>}
            </SheetBody>

            <ConfirmDialog
              open={confirmLeave}
              onOpenChange={setConfirmLeave}
              title={`Mark ${w.name} as left?`}
              description="They will no longer appear in active roster or new payroll runs. Their history is kept, and you can reactivate them later."
              confirmLabel="Mark as left"
              onConfirm={async () => {
                try {
                  await setActive.mutateAsync({ id: w.id, active: false });
                  toast.success(`${w.name} marked as left`);
                  setConfirmLeave(false);
                } catch (e) {
                  toast.error("Couldn't update status", { description: errMsg(e) });
                }
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warning" }) {
  return (
    <div className={cn("rounded-xl border p-3.5", tone === "warning" ? "border-warning/30 bg-warning-soft/60" : "border-border")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular">{value}</div>
      {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
