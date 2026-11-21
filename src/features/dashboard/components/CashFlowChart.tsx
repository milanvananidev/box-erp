import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { SectionCard } from "@/components/shared/SectionCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "@/components/ui/tooltip";
import { ErrorState } from "@/components/shared/states";
import { formatINR, formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCashFlow, useDashboardSummary, type CashFlowRange } from "../api";

function Legend() {
  return (
    <div className="flex items-center justify-center gap-6 text-[13px] text-[#344054]">
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-[3px] bg-chart-income" /> Cash In
      </span>
      <span className="flex items-center gap-2">
        <span className="size-3 rounded-[3px] bg-chart-expense" /> Cash Out
      </span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const inV = payload.find((p) => p.dataKey === "cashIn")?.value ?? 0;
  const outV = payload.find((p) => p.dataKey === "cashOut")?.value ?? 0;
  const net = inV - outV;
  return (
    <div className="min-w-48 rounded-lg border border-border bg-popover px-3 py-2.5 text-[13px] shadow-pop">
      <p className="mb-1.5 font-semibold">{label}</p>
      <div className="space-y-1 tabular">
        <Row color="bg-chart-income" label="Cash in" value={formatINR(inV)} />
        <Row color="bg-chart-expense" label="Cash out" value={formatINR(outV)} />
        <div className="mt-1 border-t border-border pt-1">
          <Row label="Net" value={formatINR(net, { sign: true })} valueClass={net >= 0 ? "text-success-foreground" : "text-danger-foreground"} />
        </div>
      </div>
    </div>
  );
}

function Row({ color, label, value, valueClass }: { color?: string; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-muted-foreground">
        {color && <span className={cn("size-2.5 rounded-sm", color)} />}
        {label}
      </span>
      <span className={cn("font-medium", valueClass)}>{value}</span>
    </div>
  );
}

export function CashFlowChart({ className }: { className?: string }) {
  const [range, setRange] = useState<CashFlowRange>("30d");
  const { data, isLoading, error, refetch } = useCashFlow(range);
  const { data: summary } = useDashboardSummary();

  const net = summary ? summary.cashIn.value - summary.cashOut.value : null;

  return (
    <SectionCard
      className={className}
      title="Income vs Expenses"
      actions={
        <Select value={range} onValueChange={(v) => setRange(v as CashFlowRange)}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="6m">Last 6 Months</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-5 text-[13px]">
          <Metric label="Net cash flow (MTD)" value={net} />
          <Metric
            label="Operating surplus (MTD)"
            value={summary?.operatingProfit.value ?? null}
            hint="Operating receipts minus operating payments. Excludes salary advances, machinery (capital) and loans, so it differs from net cash flow. Not an accrual P&L — GST invoicing stays in Vyapar."
          />
        </div>
        <Legend />
      </div>
      {error ? (
        <ErrorState compact error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-[230px] w-full" />
      ) : (
        <div className="h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={6} barCategoryGap="28%" margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 13, fill: "#344054" }} dy={6} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fontSize: 12, fill: "#475467" }}
                tickFormatter={(v: number) => formatINRCompact(v)}
              />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.7 }} content={<ChartTooltip />} />
              <Bar dataKey="cashIn" name="Cash in" fill="var(--chart-income)" radius={[3, 3, 0, 0]} maxBarSize={34} />
              <Bar dataKey="cashOut" name="Cash out" fill="var(--chart-expense)" radius={[3, 3, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

function Metric({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground">
        {label}
        {hint && (
          <Hint label={<span className="block max-w-64 leading-relaxed">{hint}</span>}>
            <Info className="size-3.5 cursor-help" />
          </Hint>
        )}
      </div>
      {value == null ? (
        <Skeleton className="mt-1 h-5 w-24" />
      ) : (
        <div className={cn("text-[15px] font-semibold tabular", value >= 0 ? "text-success-foreground" : "text-danger-foreground")}>
          {formatINR(value, { sign: true })}
        </div>
      )}
    </div>
  );
}
