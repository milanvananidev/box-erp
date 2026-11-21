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
      {/* Native Desktop Header Toolbar */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <span className="flex size-6.5 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <ArrowLeftRight className="size-3.5 text-[#C98F4F]" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-foreground tracking-tight">Recent Financial Ledger</h3>
              <p className="text-[11px] text-muted-foreground">Live cashbook and bank transactions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openTxnSheet("in")}
              className="flex h-6.5 items-center gap-1 rounded border border-emerald-300/80 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-600 hover:text-white cursor-pointer shadow-2xs"
              title="Add Income (⌘+Shift+I)"
            >
              <ArrowDownLeft className="size-3 text-emerald-600 group-hover:text-white" /> + Income
            </button>
            <button
              onClick={() => openTxnSheet("out")}
              className="flex h-6.5 items-center gap-1 rounded border border-rose-300/80 bg-rose-50 px-2 text-[11px] font-semibold text-rose-800 transition-colors hover:bg-rose-600 hover:text-white cursor-pointer shadow-2xs"
              title="Add Expense (⌘+Shift+E)"
            >
              <Plus className="size-3 text-rose-600 group-hover:text-white" /> - Expense
            </button>
            <div className="h-4 w-px bg-border" />
            <button
              onClick={() => navigate("/finance")}
              className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
            >
              All Transactions <ArrowRight className="size-3" />
            </button>
          </div>
        </div>

        {/* High-Density Desktop Table */}
        <div className="pt-2">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading ledger entries...</div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
              <Receipt className="size-5 text-muted-foreground/40" />
              <span>No transactions recorded yet</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    <th className="py-2 pr-3 font-medium w-24">Date</th>
                    <th className="py-2 px-3 font-medium">Particulars</th>
                    <th className="py-2 px-3 font-medium">Category</th>
                    <th className="py-2 px-3 font-medium w-24">Payment Mode</th>
                    <th className="py-2 px-3 font-medium w-20">Type</th>
                    <th className="py-2 pl-3 text-right font-medium w-36">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-normal">
                  {transactions.slice(0, 8).map((t) => {
                    const isIncome = t.direction === "in";
                    return (
                      <tr key={t.id} className="hover:bg-subtle/80 transition-colors">
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap text-[11px] font-mono">
                          {formatDateShort(t.date)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground max-w-[240px] truncate text-xs">
                          {t.particulars}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs truncate">
                          {t.category || "General"}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs uppercase font-mono text-[10px]">
                          {t.mode || "Bank"}
                        </td>
                        <td className="py-2 px-3">
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
                          "py-2 pl-3 text-right font-mono font-bold whitespace-nowrap text-xs tabular-nums",
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
    </div>
  );
}
