import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, Receipt, Plus, ArrowDownLeft } from "lucide-react";
import { formatDateShort, formatINR } from "@/lib/format";
import { useUI } from "@/stores/ui";
import { useRecentTransactions } from "../api";
import { cn } from "@/lib/utils";

export function RecentTransactionsCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const openTxnSheet = useUI((s) => s.openTxnSheet);
  const { data: transactions = [], isLoading } = useRecentTransactions();

  return (
    <div className={cn("flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-2xs select-none", className)}>
      {/* Native Desktop Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <ArrowLeftRight className="size-3.5 text-[#C98F4F]" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-foreground tracking-tight">Recent Financial Ledger</h3>
              <p className="text-[11px] text-muted-foreground">Latest verified cash & bank movements</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/finance")}
              className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
            >
              Full Ledger <ArrowRight className="size-3" />
            </button>
          </div>
        </div>

        {/* High-Density Desktop Table */}
        <div className="pt-1">
          {isLoading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Loading ledger...</div>
          ) : transactions.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
              <Receipt className="size-4 text-muted-foreground/50" />
              <span>No transactions recorded yet</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    <th className="py-1.5 pr-2 font-medium">Date</th>
                    <th className="py-1.5 px-2 font-medium">Particulars</th>
                    <th className="py-1.5 px-2 font-medium">Category</th>
                    <th className="py-1.5 px-2 font-medium">Type</th>
                    <th className="py-1.5 pl-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-normal">
                  {transactions.slice(0, 5).map((t) => {
                    const isIncome = t.direction === "in";
                    return (
                      <tr key={t.id} className="hover:bg-subtle/80 transition-colors">
                        <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap text-[11px] font-mono">
                          {formatDateShort(t.date)}
                        </td>
                        <td className="py-1.5 px-2 font-medium text-foreground max-w-[140px] truncate text-[11px]">
                          {t.particulars}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground text-[11px] truncate">
                          {t.category || "General"}
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight",
                              isIncome
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                                : "bg-rose-50 text-rose-700 border border-rose-200/80",
                            )}
                          >
                            {isIncome ? "Income" : "Expense"}
                          </span>
                        </td>
                        <td className={cn(
                          "py-1.5 pl-2 text-right font-mono font-bold whitespace-nowrap text-[11px] tabular-nums",
                          isIncome ? "text-emerald-600" : "text-foreground",
                        )}>
                          {isIncome ? `+ ${formatINR(t.amount)}` : `- ${formatINR(t.amount)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Micro Action Footer */}
      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-border/60">
        <button
          onClick={() => openTxnSheet("in")}
          className="flex h-7 items-center justify-center gap-1 rounded border border-emerald-300/80 bg-emerald-50/70 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer shadow-2xs"
          title="Add Income (⌘+Shift+I)"
        >
          <ArrowDownLeft className="size-3 text-emerald-600" /> + Add Income
        </button>
        <button
          onClick={() => openTxnSheet("out")}
          className="flex h-7 items-center justify-center gap-1 rounded border border-rose-300/80 bg-rose-50/70 text-[11px] font-semibold text-rose-800 transition-colors hover:bg-rose-100 cursor-pointer shadow-2xs"
          title="Add Expense (⌘+Shift+E)"
        >
          <Plus className="size-3 text-rose-600" /> - Add Expense
        </button>
      </div>
    </div>
  );
}
