import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, Receipt, Plus, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateShort, formatINR } from "@/lib/format";
import { useUI } from "@/stores/ui";
import { useRecentTransactions } from "../api";

export function RecentTransactionsCard() {
  const navigate = useNavigate();
  const openTxnSheet = useUI((s) => s.openTxnSheet);
  const { data: transactions = [], isLoading } = useRecentTransactions();

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ArrowLeftRight className="size-4 text-[#C98F4F]" />
            </span>
            <h3 className="text-base font-bold text-foreground">Recent Transactions</h3>
          </div>
          <button
            onClick={() => navigate("/finance")}
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
          >
            View All <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Transactions Table */}
        <div className="pt-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
              <Receipt className="size-5 text-muted-foreground/50" />
              <span>No transactions recorded yet</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] text-muted-foreground font-medium">
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 px-2 font-medium">Particulars</th>
                    <th className="py-2 px-2 font-medium">Type</th>
                    <th className="py-2 pl-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {transactions.slice(0, 3).map((t) => {
                    const isIncome = t.direction === "in";
                    return (
                      <tr key={t.id} className="hover:bg-subtle/50 transition-colors">
                        <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                          {formatDateShort(t.date)}
                        </td>
                        <td className="py-2 px-2 font-medium text-foreground max-w-[120px] truncate">
                          {t.particulars}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIncome
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-rose-50 text-rose-700 border border-rose-200/60"
                            }`}
                          >
                            {isIncome ? "Income" : "Expense"}
                          </span>
                        </td>
                        <td className={`py-2 pl-2 text-right font-mono font-bold whitespace-nowrap ${isIncome ? "text-emerald-600" : "text-foreground"}`}>
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

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openTxnSheet("in")}
          className="text-xs h-8 text-emerald-700 font-medium border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-100 hover:text-emerald-800 cursor-pointer shadow-2xs"
          title="Add Income (⌘+Shift+I)"
        >
          <ArrowDownLeft className="size-3.5 text-emerald-600" /> + Add Income
        </Button>
        <Button
          size="sm"
          onClick={() => openTxnSheet("out")}
          className="text-xs h-8 bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-xs cursor-pointer"
          title="Add Expense (⌘+Shift+E)"
        >
          <Plus className="size-3.5" /> - Add Expense
        </Button>
      </div>
    </div>
  );
}
