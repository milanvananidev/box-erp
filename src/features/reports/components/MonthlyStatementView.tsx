import { useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Landmark,
  Printer,
  Scroll,
  Share2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrintPortal } from "@/components/shared/PrintPortal";
import { formatINR, formatINRCompact, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/features/finance/api";
import { useMaterials } from "@/features/inventory/api";
import { useWorkerRoster } from "@/features/workers/api";
import { useCompanySettings } from "@/features/settings/api";
import { monthLabel } from "../range";

export function MonthlyStatementView() {
  const now = new Date();
  const currentMonthStr = format(now, "yyyy-MM");
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: allTxns = [] } = useTransactions();
  const { data: materials = [] } = useMaterials();
  const { data: roster = [] } = useWorkerRoster();
  const { data: company } = useCompanySettings();

  // Generate last 12 months options
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, i);
      const val = format(d, "yyyy-MM");
      return { value: val, label: monthLabel(val) };
    });
  }, []);

  // Filter transactions for selected month
  const monthTxns = useMemo(() => {
    return allTxns.filter((t) => t.date.startsWith(selectedMonth) && !t.matchedTo);
  }, [allTxns, selectedMonth]);

  // Financial Computations for Selected Month
  const summary = useMemo(() => {
    const inflows = monthTxns.filter((t) => t.direction === "in");
    const outflows = monthTxns.filter((t) => t.direction === "out");

    const totalInflow = inflows.reduce((s, t) => s + t.amount, 0);
    const totalOutflow = outflows.reduce((s, t) => s + t.amount, 0);
    const netSurplus = totalInflow - totalOutflow;
    const marginPct = totalInflow > 0 ? (netSurplus / totalInflow) * 100 : 0;

    // Group Inflows by category
    const inByCat = new Map<string, number>();
    for (const t of inflows) {
      inByCat.set(t.category, (inByCat.get(t.category) || 0) + t.amount);
    }

    // Group Outflows by category
    const outByCat = new Map<string, number>();
    for (const t of outflows) {
      outByCat.set(t.category, (outByCat.get(t.category) || 0) + t.amount);
    }

    // Payment Mode Balances for this month
    const cashIn = monthTxns.filter((t) => t.mode === "cash");
    const bankIn = monthTxns.filter((t) => t.mode === "bank" || t.mode === "upi");
    const cashNet = cashIn.reduce((s, t) => s + (t.direction === "in" ? t.amount : -t.amount), 0);
    const bankNet = bankIn.reduce((s, t) => s + (t.direction === "in" ? t.amount : -t.amount), 0);

    // Current Godown Stock Value
    const godownStockValue = materials.reduce((s, m) => s + m.value, 0);
    const paperReelsValue = materials
      .filter((m) => m.category === "Paper Roll")
      .reduce((s, m) => s + m.value, 0);

    return {
      totalInflow,
      totalOutflow,
      netSurplus,
      marginPct,
      inflowsList: Array.from(inByCat.entries()).map(([cat, amount]) => ({
        category: cat,
        amount,
        pct: totalInflow > 0 ? (amount / totalInflow) * 100 : 0,
      })),
      outflowsList: Array.from(outByCat.entries())
        .map(([cat, amount]) => ({
          category: cat,
          amount,
          pct: totalOutflow > 0 ? (amount / totalOutflow) * 100 : 0,
          pctOfIncome: totalInflow > 0 ? (amount / totalInflow) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      cashNet,
      bankNet,
      godownStockValue,
      paperReelsValue,
      workerCount: roster.filter((w) => w.active).length,
    };
  }, [monthTxns, materials, roster]);

  // Navigate Previous / Next Month
  const handlePrevMonth = () => {
    const idx = monthOptions.findIndex((m) => m.value === selectedMonth);
    if (idx < monthOptions.length - 1) setSelectedMonth(monthOptions[idx + 1]!.value);
  };
  const handleNextMonth = () => {
    const idx = monthOptions.findIndex((m) => m.value === selectedMonth);
    if (idx > 0) setSelectedMonth(monthOptions[idx - 1]!.value);
  };

  // Copy WhatsApp Summary
  const handleCopyWhatsApp = () => {
    const mLabel = monthLabel(selectedMonth);
    const cName = company?.name || "BoxERP Factory";

    let text = `📦 *${cName.toUpperCase()} — MONTHLY STATEMENT*\n`;
    text += `📅 *Month:* ${mLabel}\n`;
    text += `───────────────────────\n`;
    text += `💰 *TOTAL CASH INFLOW:* ${formatINR(summary.totalInflow)}\n`;
    for (const item of summary.inflowsList) {
      text += `  • ${item.category}: ${formatINR(item.amount)} (${item.pct.toFixed(1)}%)\n`;
    }
    text += `\n📉 *TOTAL FACTORY OUTFLOW:* ${formatINR(summary.totalOutflow)}\n`;
    for (const item of summary.outflowsList) {
      text += `  • ${item.category}: ${formatINR(item.amount)} (${item.pct.toFixed(1)}%)\n`;
    }
    text += `───────────────────────\n`;
    text += `🟢 *NET OPERATING SURPLUS:* ${formatINR(summary.netSurplus, { sign: true })}\n`;
    text += `📊 *Surplus Margin:* ${summary.marginPct.toFixed(1)}%\n`;
    text += `🏭 *Godown Raw Stock:* ${formatINR(summary.godownStockValue)}\n`;
    text += `───────────────────────\n`;
    text += `_Generated from BoxERP_`;

    navigator.clipboard.writeText(text);
    toast.success("Copied monthly statement for WhatsApp!", {
      description: "You can now paste and send this directly to partners or management.",
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const rows = [
      ["BOX FACTORY MONTHLY STATEMENT", monthLabel(selectedMonth)],
      [],
      ["INFLOW CATEGORY", "AMOUNT (INR)", "% OF TOTAL"],
      ...summary.inflowsList.map((i) => [i.category, fromPaise(i.amount), i.pct.toFixed(1) + "%"]),
      ["TOTAL INFLOW", fromPaise(summary.totalInflow), "100%"],
      [],
      ["EXPENSE CATEGORY", "AMOUNT (INR)", "% OF EXPENSES", "% OF REVENUE"],
      ...summary.outflowsList.map((o) => [
        o.category,
        fromPaise(o.amount),
        o.pct.toFixed(1) + "%",
        o.pctOfIncome.toFixed(1) + "%",
      ]),
      ["TOTAL OUTFLOW", fromPaise(summary.totalOutflow), "100%"],
      [],
      ["NET OPERATING SURPLUS", fromPaise(summary.netSurplus), summary.marginPct.toFixed(1) + "% MARGIN"],
      ["GODOWN RAW MATERIAL STOCK", fromPaise(summary.godownStockValue)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Monthly-Statement-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported statement for ${monthLabel(selectedMonth)}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handlePrevMonth}
            disabled={selectedMonth === monthOptions[monthOptions.length - 1]?.value}
            aria-label="Previous Month"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-52 h-9 font-semibold text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="font-medium">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleNextMonth}
            disabled={selectedMonth === monthOptions[0]?.value}
            aria-label="Next Month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Action Buttons: WhatsApp & Print */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyWhatsApp}
            className="text-emerald-700 bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100 font-semibold"
          >
            <Share2 className="size-3.5" /> Share on WhatsApp
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCsv} className="font-medium">
            <Download className="size-3.5" /> Export Excel / CSV
          </Button>

          <Button
            size="sm"
            onClick={() => setIsPrinting(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold"
          >
            <Printer className="size-3.5" /> Print Statement (A4)
          </Button>
        </div>
      </div>

      {/* Hero Financial Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflow */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Total Inflow (Receipts)</span>
              <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600">
                {formatINR(summary.totalInflow)}
              </div>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="size-5" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {summary.inflowsList.length} receipt categories
          </div>
        </div>

        {/* Total Outflow */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Total Factory Outflow</span>
              <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {formatINR(summary.totalOutflow)}
              </div>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <ArrowUpRight className="size-5" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {summary.outflowsList.length} expense heads recorded
          </div>
        </div>

        {/* Net Operating Surplus */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-5 shadow-xs",
            summary.netSurplus >= 0 ? "border-emerald-200 bg-emerald-50/20" : "border-rose-200 bg-rose-50/20",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Net Operating Surplus</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    summary.marginPct >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800",
                  )}
                >
                  {summary.marginPct.toFixed(1)}% Margin
                </span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold font-mono tracking-tight",
                  summary.netSurplus >= 0 ? "text-emerald-700" : "text-rose-600",
                )}
              >
                {formatINR(summary.netSurplus, { sign: true })}
              </div>
            </div>
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                summary.netSurplus >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
              )}
            >
              <TrendingUp className="size-5" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {summary.netSurplus >= 0 ? "Net operating profit for the month" : "Operating deficit for the month"}
          </div>
        </div>

        {/* Godown Stock & Working Capital */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Godown Raw Stock Value</span>
              <div className="text-2xl font-bold font-mono tracking-tight text-brand-700">
                {formatINR(summary.godownStockValue)}
              </div>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Scroll className="size-5 text-[#C98F4F]" />
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Paper Reels: {formatINRCompact(summary.paperReelsValue)} · {summary.workerCount} workers
          </div>
        </div>
      </div>

      {/* Main Breakdown: Inflow Table vs Outflow Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Receipts & Cash Inflow (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <ArrowDownLeft className="size-4" />
                </span>
                <h3 className="text-base font-bold text-foreground">1. Cash Inflow (Receipts)</h3>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-700">
                {formatINR(summary.totalInflow)}
              </span>
            </div>

            {summary.inflowsList.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No receipts recorded this month.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {summary.inflowsList.map((item) => (
                  <div key={item.category} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-foreground text-sm">{item.category}</div>
                      <div className="text-muted-foreground">{item.pct.toFixed(1)}% of total receipts</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm text-foreground">{formatINR(item.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Mode Snapshot */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Landmark className="size-4 text-brand-600" />
              <h4 className="text-sm font-bold text-foreground">Cash & Bank Movement (This Month)</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-subtle p-3 border border-border/80">
                <div className="text-xs text-muted-foreground">Cash in Hand Net</div>
                <div
                  className={cn(
                    "text-base font-bold font-mono mt-0.5",
                    summary.cashNet >= 0 ? "text-emerald-700" : "text-rose-600",
                  )}
                >
                  {formatINR(summary.cashNet, { sign: true })}
                </div>
              </div>
              <div className="rounded-xl bg-subtle p-3 border border-border/80">
                <div className="text-xs text-muted-foreground">Bank & UPI Net</div>
                <div
                  className={cn(
                    "text-base font-bold font-mono mt-0.5",
                    summary.bankNet >= 0 ? "text-emerald-700" : "text-rose-600",
                  )}
                >
                  {formatINR(summary.bankNet, { sign: true })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Outflows & Factory Expenses (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                  <ArrowUpRight className="size-4" />
                </span>
                <h3 className="text-base font-bold text-foreground">2. Factory Expenses (Outflows)</h3>
              </div>
              <span className="font-mono text-sm font-bold text-foreground">
                {formatINR(summary.totalOutflow)}
              </span>
            </div>

            {summary.outflowsList.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No expenses recorded this month.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {summary.outflowsList.map((item) => (
                  <div key={item.category} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{item.category}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          ({item.pct.toFixed(1)}% of outgo)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-sm text-foreground">
                        {formatINR(item.amount)}
                      </span>
                    </div>

                    {/* Progress Bar showing proportion of total expenses */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${Math.min(100, item.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Sheet (Standard A4 Format) */}
      {isPrinting && (
        <PrintPortal onDone={() => setIsPrinting(false)}>
          <div className="p-8 max-w-[800px] mx-auto text-black font-sans print-page space-y-6">
            {/* Header */}
            <div className="border-b-2 border-black pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">
                  {company?.name || "BOX FACTORY"}
                </h1>
                <p className="text-xs text-gray-600">
                  {company?.address || "Corrugated Packaging Works"}
                  {company?.gstin && ` • GSTIN: ${company.gstin}`}
                </p>
                <h2 className="text-base font-bold mt-2 text-gray-800">
                  MONTHLY EXECUTIVE FINANCIAL STATEMENT — {monthLabel(selectedMonth).toUpperCase()}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 block">Generated On</span>
                <span className="font-bold text-xs">{format(new Date(), "dd MMM yyyy, hh:mm a")}</span>
              </div>
            </div>

            {/* Key Totals Box */}
            <div className="grid grid-cols-3 border border-black p-3 bg-gray-50 text-center text-sm font-semibold">
              <div>
                <div className="text-xs uppercase text-gray-600 font-normal">Total Receipts</div>
                <div className="text-base font-black text-black">{formatINR(summary.totalInflow)}</div>
              </div>
              <div className="border-x border-black">
                <div className="text-xs uppercase text-gray-600 font-normal">Total Expenses</div>
                <div className="text-base font-black text-black">{formatINR(summary.totalOutflow)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-600 font-normal">Operating Surplus</div>
                <div className="text-base font-black text-black">
                  {formatINR(summary.netSurplus, { sign: true })} ({summary.marginPct.toFixed(1)}%)
                </div>
              </div>
            </div>

            {/* Inflows Table */}
            <div>
              <h3 className="font-bold text-sm border-b border-black pb-1 mb-2 uppercase">1. Receipts (Cash In)</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-600 text-left">
                    <th className="py-1">Category</th>
                    <th className="py-1 text-right">Share %</th>
                    <th className="py-1 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.inflowsList.map((i) => (
                    <tr key={i.category} className="border-b border-gray-100">
                      <td className="py-1.5 font-medium">{i.category}</td>
                      <td className="py-1.5 text-right text-gray-600">{i.pct.toFixed(1)}%</td>
                      <td className="py-1.5 text-right font-bold">{formatINR(i.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-black border-t border-black">
                    <td className="py-1.5">Total Inflow</td>
                    <td className="py-1.5 text-right">100%</td>
                    <td className="py-1.5 text-right">{formatINR(summary.totalInflow)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Outflows Table */}
            <div>
              <h3 className="font-bold text-sm border-b border-black pb-1 mb-2 uppercase">2. Factory Expenses (Cash Out)</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-600 text-left">
                    <th className="py-1">Expense Head</th>
                    <th className="py-1 text-right">% of Expenses</th>
                    <th className="py-1 text-right">% of Receipts</th>
                    <th className="py-1 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.outflowsList.map((o) => (
                    <tr key={o.category} className="border-b border-gray-100">
                      <td className="py-1.5 font-medium">{o.category}</td>
                      <td className="py-1.5 text-right text-gray-600">{o.pct.toFixed(1)}%</td>
                      <td className="py-1.5 text-right text-gray-600">{o.pctOfIncome.toFixed(1)}%</td>
                      <td className="py-1.5 text-right font-bold">{formatINR(o.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-black border-t border-black">
                    <td className="py-1.5">Total Outflow</td>
                    <td className="py-1.5 text-right">100%</td>
                    <td className="py-1.5 text-right">—</td>
                    <td className="py-1.5 text-right">{formatINR(summary.totalOutflow)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Godown Asset Snapshot */}
            <div className="border-t border-black pt-2 text-xs flex justify-between text-gray-700">
              <span>Closing Godown Raw Stock: <b>{formatINR(summary.godownStockValue)}</b></span>
              <span>Active Payroll Workers: <b>{summary.workerCount}</b></span>
            </div>

            {/* Signature Block */}
            <div className="pt-12 flex justify-between text-xs text-gray-600">
              <div className="border-t border-black pt-2 w-48 text-center">
                Prepared By (Accountant)
              </div>
              <div className="border-t border-black pt-2 w-48 text-center">
                Verified By (Partner / Director)
              </div>
            </div>
          </div>
        </PrintPortal>
      )}
    </div>
  );
}
