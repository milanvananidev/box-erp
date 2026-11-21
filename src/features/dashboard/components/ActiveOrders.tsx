import { Factory } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { SectionCard } from "@/components/shared/SectionCard";
import { StageBadge } from "@/components/shared/StatusBadge";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/shared/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TODAY } from "@/data/mock/seed";
import { useNavigate } from "react-router-dom";
import { useActiveOrders } from "../api";

function DueLabel({ due }: { due: string }) {
  const d = differenceInCalendarDays(parseISO(due), TODAY);
  const text = d < 0 ? `${-d}d overdue` : d === 0 ? "Due today" : d === 1 ? "Tomorrow" : `in ${d} days`;
  return <span className={cn("text-xs", d <= 0 ? "font-medium text-danger-foreground" : "text-muted-foreground")}>{text}</span>;
}

export function ActiveOrders({ className }: { className?: string }) {
  const { data, isLoading, error, refetch } = useActiveOrders();
  const navigate = useNavigate();
  return (
    <SectionCard className={className} title="Production Orders in Progress" viewAllHref="/production" contentClassName="px-0 pb-2">
      {error ? (
        <ErrorState compact error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <RowsSkeleton rows={4} className="px-5" />
      ) : data.length === 0 ? (
        <EmptyState compact icon={Factory} title="No active orders" description="Production orders you start will appear here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Order No.</TableHead>
              <TableHead>Customer / Product</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 4).map((o) => {
              const pct = (o.producedQty / o.plannedQty) * 100;
              return (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/production?order=${o.id}`)}>
                  <TableCell>
                    <div className="font-medium">{o.orderNo}</div>
                    <DueLabel due={o.dueDate} />
                  </TableCell>
                  <TableCell className="max-w-48">
                    <div className="truncate">{o.customer}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.product} · {o.spec.lengthMm}×{o.spec.widthMm}×{o.spec.heightMm} mm
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="tabular">
                      {formatQty(o.producedQty)} <span className="text-muted-foreground">/ {formatQty(o.plannedQty)}</span>
                    </div>
                    <div className="mt-1 ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StageBadge stage={o.stage} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
