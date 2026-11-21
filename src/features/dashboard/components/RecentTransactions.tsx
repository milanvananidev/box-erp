import { Receipt } from "lucide-react";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/shared/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DirectionBadge, SourceTag } from "@/features/finance/components/badges";
import { formatDateShort, formatINR } from "@/lib/format";
import { useRecentTransactions } from "../api";

export function RecentTransactions({ className }: { className?: string }) {
  const { data, isLoading, error, refetch } = useRecentTransactions();
  return (
    <SectionCard className={className} title="Recent Transactions" viewAllHref="/finance" contentClassName="px-0 pb-2">
      {error ? (
        <ErrorState compact error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <RowsSkeleton rows={4} className="px-5" />
      ) : data.length === 0 ? (
        <EmptyState compact icon={Receipt} title="No transactions yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Particulars</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-[#475467]">{formatDateShort(t.date)}</TableCell>
                <TableCell className="max-w-64">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{t.particulars}</span>
                    <SourceTag source={t.source} />
                  </div>
                </TableCell>
                <TableCell>
                  <DirectionBadge direction={t.direction} />
                </TableCell>
                <TableCell className="text-right font-medium">{formatINR(t.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
