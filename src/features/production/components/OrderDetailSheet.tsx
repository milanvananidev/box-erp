import { useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Flame, Pause, Pencil, Play, Trash2, X } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StageBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/shared/states";
import { STAGE_LABEL, WASTAGE_REASONS, blankSize, formatSize, nextStage, paperPerBox, specLine } from "@/lib/production";
import { formatDate, formatPercent, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductionEntry, ProductionOrder } from "@/types/domain";
import { useDeleteEntry, useDeleteOrder, useHoldOrder, useProductionEntries, useResumeOrder, useSetStage } from "../api";
import { StageStepper } from "./StageStepper";
import { HoldDialog } from "./HoldDialog";
import { LogOutputForm } from "./LogOutputForm";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : undefined);

export function DueText({ order, className }: { order: Pick<ProductionOrder, "dueDate" | "stage" | "completedOn">; className?: string }) {
  if (order.stage === "completed")
    return <span className={cn("text-xs text-muted-foreground", className)}>Done {order.completedOn ? formatDate(order.completedOn) : ""}</span>;
  const d = differenceInCalendarDays(parseISO(order.dueDate), new Date());
  const text = d < 0 ? `${-d}d overdue` : d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `Due in ${d} days`;
  return <span className={cn("text-xs", d <= 0 ? "font-medium text-danger-foreground" : d <= 2 ? "text-warning-foreground" : "text-muted-foreground", className)}>{text}</span>;
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular", tone === "danger" && "text-danger-foreground", tone === "success" && "text-success-foreground")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground tabular">{sub}</div>}
    </div>
  );
}

export function OrderDetailSheet({ order, onClose, onEdit }: { order: ProductionOrder | undefined; onClose: () => void; onEdit: (o: ProductionOrder) => void }) {
  const entries = useProductionEntries(order?.id);
  const setStage = useSetStage();
  const hold = useHoldOrder();
  const resume = useResumeOrder();
  const delOrder = useDeleteOrder();
  const delEntry = useDeleteEntry();
  const [holdOpen, setHoldOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ProductionEntry | null>(null);

  const o = order;
  const next = o ? nextStage(o) : null;
  const pct = o ? Math.min(100, (o.producedQty / o.plannedQty) * 100) : 0;
  const wastePct = o && o.producedQty + o.wastageQty > 0 ? (o.wastageQty / (o.producedQty + o.wastageQty)) * 100 : 0;
  const completed = o?.stage === "completed";
  const held = o?.stage === "on_hold";
  const short = o ? o.plannedQty - o.producedQty : 0;

  const advance = async () => {
    if (!o || !next) return;
    if (next === "completed" && short > 0) return setConfirmComplete(true);
    try {
      await setStage.mutateAsync({ id: o.id, stage: next });
      toast.success(`${o.orderNo} moved to ${STAGE_LABEL[next]}`);
    } catch (e) {
      toast.error("Couldn't change stage", { description: errMsg(e) });
    }
  };

  return (
    <Sheet open={!!o} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width="lg">
        {o && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2.5">
                <SheetTitle>{o.orderNo}</SheetTitle>
                <StageBadge stage={o.stage} />
                {o.priority === "urgent" && <Badge tone="danger"><Flame /> Urgent</Badge>}
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium text-foreground">{o.customer}</span>
                {o.customerRef && <span>· Ref {o.customerRef}</span>}
                <span>· {o.product}</span>
                <span>· {formatDate(o.startDate)} → {formatDate(o.dueDate)}</span>
                <DueText order={o} />
              </SheetDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {!completed && !held && next && (
                  <Button onClick={advance} loading={setStage.isPending}>
                    {next === "completed" ? <CheckCircle2 /> : <ArrowRight />}
                    {next === "completed" ? "Mark completed" : `Move to ${STAGE_LABEL[next]}`}
                  </Button>
                )}
                {held && (
                  <Button loading={resume.isPending} onClick={async () => {
                    try { await resume.mutateAsync(o.id); toast.success(`${o.orderNo} resumed`); } catch (e) { toast.error("Couldn't resume", { description: errMsg(e) }); }
                  }}>
                    <Play /> Resume
                  </Button>
                )}
                {!completed && <Button variant="outline" onClick={() => onEdit(o)}><Pencil /> Edit</Button>}
                {!completed && !held && <Button variant="outline" onClick={() => setHoldOpen(true)}><Pause /> Hold</Button>}
                <Hint label={o.producedQty + o.wastageQty > 0 ? "Orders with logged output can't be deleted. Put it on hold instead." : "Delete order"}>
                  <span className="ml-auto">
                    <Button variant="ghost" className="text-danger-foreground hover:bg-danger-soft" disabled={o.producedQty + o.wastageQty > 0} onClick={() => setConfirmDelete(true)}>
                      <Trash2 /> Delete
                    </Button>
                  </span>
                </Hint>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-6">
              {held && (
                <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm">
                  <Pause className="mt-0.5 size-4 text-danger-foreground" />
                  <div>
                    <p className="font-medium text-danger-foreground">On hold at {STAGE_LABEL[o.heldFromStage ?? "planned"]}</p>
                    <p className="text-[#7a2a2d]">{o.holdReason}</p>
                  </div>
                </div>
              )}

              <section className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-medium">Progress</span>
                    <span className="tabular"><span className="font-semibold">{formatQty(o.producedQty)}</span> / {formatQty(o.plannedQty)} pcs · {Math.round(pct)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-[width] duration-500", completed ? "bg-success" : "bg-brand-500")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Metric label="Produced" value={formatQty(o.producedQty)} sub="good pieces" />
                  <Metric label={short >= 0 ? "Remaining" : "Over plan"} value={formatQty(Math.abs(short))} sub="pieces" tone={short < 0 ? "success" : undefined} />
                  <Metric label="Wastage" value={formatQty(o.wastageQty)} sub={`${formatPercent(wastePct)} of output`} tone={wastePct > 3 ? "danger" : undefined} />
                  <Metric label="Paper used (est.)" value={`${formatQty(Math.round((paperPerBox(o.spec) * (o.producedQty + o.wastageQty)) / 1000))} kg`} sub={`≈ ${paperPerBox(o.spec)} g / box`} />
                </div>
              </section>

              <section className="rounded-xl border border-border p-5">
                <StageStepper order={o} />
              </section>

              <section className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border p-4 text-sm">
                <h3 className="col-span-2 mb-1 font-semibold">Box specification</h3>
                <Spec label="Inner size (L×W×H)" value={formatSize(o.spec)} />
                <Spec label="Board" value={specLine(o.spec)} />
                <Spec label="Sheet size (L × deckle)" value={`${blankSize(o.spec).lengthMm} × ${blankSize(o.spec).widthMm} mm`} />
                <Spec label="Style" value="RSC (FEFCO 0201)" />
                {o.notes && <div className="col-span-2 mt-1 rounded-lg bg-subtle p-3 text-[13px] text-[#475467]">{o.notes}</div>}
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Production log</h3>
                {!completed && !held && <LogOutputForm order={o} />}
                {entries.error ? (
                  <ErrorState compact error={entries.error} onRetry={() => entries.refetch()} />
                ) : entries.isLoading ? (
                  <RowsSkeleton rows={3} />
                ) : !entries.data?.length ? (
                  <EmptyState compact title="No output logged yet" description="Log each shift's good pieces and wastage. Progress and wastage % update automatically." />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Date</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead className="text-right">Good</TableHead>
                          <TableHead className="text-right">Wastage</TableHead>
                          <TableHead>Reason / note</TableHead>
                          <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.data.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell>{formatDate(e.date)}</TableCell>
                            <TableCell>{STAGE_LABEL[e.stage]}</TableCell>
                            <TableCell className="text-right font-medium">{formatQty(e.goodQty)}</TableCell>
                            <TableCell className={cn("text-right", e.wastageQty > 0 && "text-danger-foreground")}>{formatQty(e.wastageQty)}</TableCell>
                            <TableCell className="max-w-56 truncate text-[13px] text-muted-foreground">
                              {[e.wastageReason && WASTAGE_REASONS[e.wastageReason], e.note].filter(Boolean).join(" · ") || "—"}
                            </TableCell>
                            <TableCell>
                              {!completed && (
                                <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => setEntryToDelete(e)}>
                                  <X />
                                </Button>
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

            <HoldDialog
              open={holdOpen}
              onOpenChange={setHoldOpen}
              busy={hold.isPending}
              onConfirm={async (reason) => {
                try { await hold.mutateAsync({ id: o.id, reason }); toast.success(`${o.orderNo} put on hold`); setHoldOpen(false); }
                catch (e) { toast.error("Couldn't put on hold", { description: errMsg(e) }); }
              }}
            />
            <ConfirmDialog
              open={confirmComplete}
              onOpenChange={setConfirmComplete}
              title={`Complete ${o.orderNo} short?`}
              description={<>Only <b className="text-foreground">{formatQty(o.producedQty)}</b> of {formatQty(o.plannedQty)} pcs have been produced ({formatQty(short)} short). Completing locks the production log.</>}
              confirmLabel="Complete anyway"
              onConfirm={async () => {
                try { await setStage.mutateAsync({ id: o.id, stage: "completed" }); toast.success(`${o.orderNo} completed`); }
                catch (e) { toast.error("Couldn't complete", { description: errMsg(e) }); throw e; }
              }}
            />
            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title={`Delete ${o.orderNo}?`}
              description="The order will be removed permanently. This can't be undone."
              onConfirm={async () => {
                try { await delOrder.mutateAsync(o.id); toast.success(`${o.orderNo} deleted`); onClose(); }
                catch (e) { toast.error("Couldn't delete", { description: errMsg(e) }); throw e; }
              }}
            />
            <ConfirmDialog
              open={!!entryToDelete}
              onOpenChange={(v) => !v && setEntryToDelete(null)}
              title="Delete this log entry?"
              description={entryToDelete && <>{formatDate(entryToDelete.date)} · {STAGE_LABEL[entryToDelete.stage]}: {formatQty(entryToDelete.goodQty)} good, {formatQty(entryToDelete.wastageQty)} wastage. The order's totals are recalculated.</>}
              onConfirm={async () => {
                if (!entryToDelete) return;
                try { await delEntry.mutateAsync(entryToDelete.id); toast.success("Entry deleted"); }
                catch (e) { toast.error("Couldn't delete entry", { description: errMsg(e) }); throw e; }
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
