import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { formatINR, formatINRCompact } from "@/lib/format";
import { useCashFlow, type CashFlowRange } from "../api";
import { cn } from "@/lib/utils";

export function CashMovementCard({ className }: { className?: string }) {
  const [range, setRange] = useState<CashFlowRange>("6m");
  const { data: chartData, isLoading } = useCashFlow(range);

  return (
    <div className={cn("flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-2xs select-none", className)}>
      {/* Native Desktop Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <TrendingUp className="size-3.5 text-[#C98F4F]" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-foreground tracking-tight">Cash Movement Flow</h3>
            <p className="text-[11px] text-muted-foreground">Inflow vs outflow overview</p>
          </div>
        </div>

        {/* Native Segmented Switcher */}
        <div className="flex items-center rounded-md border border-border bg-subtle p-0.5 text-xs">
          <button
            onClick={() => setRange("6m")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer",
              range === "6m" ? "bg-card text-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Last 6 Months
          </button>
          <button
            onClick={() => setRange("30d")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer",
              range === "30d" ? "bg-card text-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-52 w-full pt-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading cashflow trends...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData || []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatINRCompact(val)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const inVal = Number(payload.find((p) => p.dataKey === "cashIn")?.value ?? 0);
                  const outVal = Number(payload.find((p) => p.dataKey === "cashOut")?.value ?? 0);
                  return (
                    <div className="rounded-md border border-border bg-popover p-2 text-xs shadow-md">
                      <p className="font-bold text-[11px] mb-1">{label}</p>
                      <div className="space-y-0.5">
                        <div className="flex justify-between gap-3 text-[11px]">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-emerald-600" /> Cash In:
                          </span>
                          <span className="font-semibold text-foreground font-mono">{formatINR(inVal)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-[11px]">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-amber-500" /> Cash Out:
                          </span>
                          <span className="font-semibold text-foreground font-mono">{formatINR(outVal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="cashIn" fill="#16A34A" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="cashOut" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sleek Legend */}
      <div className="flex items-center justify-center gap-6 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-emerald-600" /> Cash Inflow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-amber-500" /> Cash Outflow
        </span>
      </div>
    </div>
  );
}
