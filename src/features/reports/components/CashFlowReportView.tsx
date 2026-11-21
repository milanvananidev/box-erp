import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR, formatINRCompact, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCashFlowReport, type CashFlowReport } from "../api";
import { monthLabel, type ReportRange } from "../range";
import { ReportShell } from "./ReportShell";
import { ReportTable, tableToCsv, type RCol } from "./ReportTable";

const T_LABEL = { operating: "Operating", advance: "Salary advances", capital: "Capital (machinery)", loan: "Loans", transfer: "Transfers (bank ↔ cash)" } as const;
const M_LABEL = { cash: "Cash", bank: "Bank", upi: "UPI" } as const;
const net = (v: number) => <span className={cn("font-semibold", v < 0 && "text-danger-foreground")}>{formatINR(v, { sign: true })}</span>;

type TRow = CashFlowReport["byTreatment"][number];
type MRow = CashFlowReport["byMode"][number];
type MonRow = CashFlowReport["months"][number];

export function CashFlowReportView({ range }: { range: ReportRange }) {
  const { data, isLoading, error, refetch } = useCashFlowReport(range);
  const t = data?.totals;
  const sumCols = <R extends { cashIn: number; cashOut: number; net: number }>(first: RCol<R>): RCol<R>[] => [
    first,
    { header: "Cash in", align: "right", cell: (r) => formatINR(r.cashIn), csv: (r) => fromPaise(r.cashIn), total: t && formatINR(t.cashIn), totalCsv: t && fromPaise(t.cashIn) },
    { header: "Cash out", align: "right", cell: (r) => formatINR(r.cashOut), csv: (r) => fromPaise(r.cashOut), total: t && formatINR(t.cashOut), totalCsv: t && fromPaise(t.cashOut) },
    { header: "Net", align: "right", cell: (r) => net(r.net), csv: (r) => fromPaise(r.net), total: t && net(t.net), totalCsv: t && fromPaise(t.net) },
  ];
  const tCols = sumCols<TRow>({ header: "Activity", cell: (r) => T_LABEL[r.treatment], csv: (r) => T_LABEL[r.treatment] });
  const mCols = sumCols<MRow>({ header: "Mode", cell: (r) => <span className="font-medium">{M_LABEL[r.mode]}</span>, csv: (r) => M_LABEL[r.mode] });
  const monCols: RCol<MonRow>[] = [
    ...sumCols<MonRow>({ header: "Month", cell: (r) => <span className="font-medium">{monthLabel(r.month)}</span>, csv: (r) => r.month }),
    { header: "Cumulative", align: "right", cell: (r) => net(r.cumulative), csv: (r) => fromPaise(r.cumulative) },
  ];
  const op = data?.byTreatment.find((x) => x.treatment === "operating");

  return (
    <ReportShell
      id="cash-flow"
      title="Cash Flow"
      range={range}
      isLoading={isLoading}
      error={error}
      onRetry={() => refetch()}
      kpis={[
        { label: "Cash in", value: t ? formatINR(t.cashIn) : "" },
        { label: "Cash out", value: t ? formatINR(t.cashOut) : "" },
        { label: "Net cash flow", value: t ? formatINR(t.net, { sign: true }) : "", tone: t && (t.net >= 0 ? "good" : "bad"), sub: "All activities" },
        { label: "From operations", value: op ? formatINR(op.net, { sign: true }) : "", tone: op && (op.net >= 0 ? "good" : "bad"), sub: "Before advances, capital & loans" },
      ]}
      chart={
        data && (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 12, fill: "#344054" }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "#475467" }} tickFormatter={(v: number) => formatINRCompact(v)} />
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="cashIn" name="Cash in" fill="var(--chart-income)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey="cashOut" name="Cash out" fill="var(--chart-expense)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Line dataKey="cumulative" name="Cumulative net" stroke="var(--brand-600)" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )
      }
      sections={
        data
          ? [
              { title: "By activity", description: "Separates trading cash from advances, capital and loans", table: <ReportTable columns={tCols} rows={data.byTreatment} rowKey={(r) => r.treatment} />, csv: tableToCsv(tCols, data.byTreatment), half: true },
              { title: "By payment mode", table: <ReportTable columns={mCols} rows={data.byMode} rowKey={(r) => r.mode} />, csv: tableToCsv(mCols, data.byMode), half: true },
              { title: "Month by month", table: <ReportTable columns={monCols} rows={data.months} rowKey={(r) => r.month} />, csv: tableToCsv(monCols, data.months) },
            ]
          : [{ title: "By activity", table: null, half: true }, { title: "By payment mode", table: null, half: true }, { title: "Month by month", table: null }]
      }
      notes={<p>Opening cash and bank balances aren't recorded yet, so this shows movement in the period, not closing balances. Mode-wise net shows which account the money moved through.</p>}
    />
  );
}
