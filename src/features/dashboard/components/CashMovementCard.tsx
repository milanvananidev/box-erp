import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, formatINRCompact } from "@/lib/format";
import { useCashFlow, type CashFlowRange } from "../api";

export function CashMovementCard({ className }: { className?: string }) {
  const [range, setRange] = useState<CashFlowRange>("6m");
  const { data: chartData, isLoading } = useCashFlow(range);

  return (
    <div className={`flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs ${className || ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <TrendingUp className="size-4 text-[#C98F4F]" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground leading-tight">Cash Movement</h3>
            <p className="text-xs text-muted-foreground">Cash in vs cash out over time</p>
          </div>
        </div>

        <Select value={range} onValueChange={(v) => setRange(v as CashFlowRange)}>
          <SelectTrigger className="h-8 text-xs font-medium w-[130px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6m">Last 6 Months</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      <div className="h-56 w-full pt-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData || []}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F2F5" />
              <XAxis
                dataKey="label"
                stroke="#667085"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#667085"
                fontSize={11}
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
                    <div className="rounded-xl border border-border bg-popover p-2.5 text-xs shadow-md">
                      <p className="font-bold mb-1.5">{label}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full bg-[#16A34A]" /> Cash In:
                          </span>
                          <span className="font-semibold text-foreground">{formatINR(inVal)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full bg-[#F7A361]" /> Cash Out:
                          </span>
                          <span className="font-semibold text-foreground">{formatINR(outVal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="cashIn" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="cashOut" fill="#F7A361" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-[#16A34A]" /> Cash In
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-[#F7A361]" /> Cash Out
        </span>
      </div>
    </div>
  );
}
