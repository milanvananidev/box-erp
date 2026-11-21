import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatINRCompact, formatPercent, fromPaise } from "@/lib/format";
import { useLabourReport, type LabourReport } from "../api";
import { monthLabel, type ReportRange } from "../range";
import { ReportShell } from "./ReportShell";
import { ReportTable, tableToCsv, type RCol } from "./ReportTable";

type D = LabourReport["departments"][number];
type M = LabourReport["months"][number];

export function LabourReportView({ range }: { range: ReportRange }) {
  const { data, isLoading, error, refetch } = useLabourReport(range);
  const t = data?.totals;
  const payrollGross = data?.departments.reduce((s, d) => s + d.gross, 0) ?? 0;
  const perDay = t && t.manDays ? Math.round(payrollGross / t.manDays) : 0;

  const dCols: RCol<D>[] = [
    { header: "Department", cell: (d) => <span className="font-medium">{d.department}</span>, csv: (d) => d.department },
    { header: "Workers", align: "right", cell: (d) => d.workers },
    { header: "Man-days", align: "right", cell: (d) => d.manDays.toLocaleString("en-IN"), csv: (d) => d.manDays },
    { header: "Basic", align: "right", cell: (d) => formatINR(d.basic), csv: (d) => fromPaise(d.basic) },
    { header: "Overtime", align: "right", cell: (d) => formatINR(d.overtime), csv: (d) => fromPaise(d.overtime) },
    { header: "Gross", align: "right", cell: (d) => <b>{formatINR(d.gross)}</b>, csv: (d) => fromPaise(d.gross), total: formatINR(payrollGross), totalCsv: fromPaise(payrollGross) },
    { header: "Share", align: "right", cell: (d) => formatPercent(payrollGross ? (d.gross / payrollGross) * 100 : 0), csv: (d) => (payrollGross ? ((d.gross / payrollGross) * 100).toFixed(1) : "") },
    { header: "Per man-day", align: "right", cell: (d) => (d.manDays ? formatINR(Math.round(d.gross / d.manDays)) : "—"), csv: (d) => (d.manDays ? fromPaise(Math.round(d.gross / d.manDays)) : "") },
  ];
  const mCols: RCol<M>[] = [
    { header: "Month", cell: (m) => <span className="inline-flex items-center gap-2 font-medium">{monthLabel(m.month)}{m.basis === "cash" && <Badge tone="outline">cash basis</Badge>}</span>, csv: (m) => m.month },
    { header: "Man-days", align: "right", cell: (m) => (m.manDays ? m.manDays.toLocaleString("en-IN") : "—"), csv: (m) => m.manDays },
    { header: "Basic", align: "right", cell: (m) => formatINR(m.basic), csv: (m) => fromPaise(m.basic) },
    { header: "Overtime", align: "right", cell: (m) => formatINR(m.overtime), csv: (m) => fromPaise(m.overtime), total: t && formatINR(t.overtime), totalCsv: t && fromPaise(t.overtime) },
    { header: "Bonus", align: "right", cell: (m) => formatINR(m.bonus), csv: (m) => fromPaise(m.bonus) },
    { header: "Labour cost", align: "right", cell: (m) => <b>{formatINR(m.gross)}</b>, csv: (m) => fromPaise(m.gross), total: t && formatINR(t.gross), totalCsv: t && fromPaise(t.gross) },
  ];

  return (
    <ReportShell
      id="labour"
      title="Labour Cost"
      range={range}
      isLoading={isLoading}
      error={error}
      onRetry={() => refetch()}
      kpis={[
        { label: "Labour cost", value: t ? formatINR(t.gross) : "", sub: "Payroll gross (earned)" },
        { label: "Overtime share", value: t ? formatPercent(t.gross ? (t.overtime / t.gross) * 100 : 0) : "", sub: t && `${formatINR(t.overtime)} overtime` },
        { label: "Cost per man-day", value: t ? formatINR(perDay) : "", sub: t && `${t.manDays.toLocaleString("en-IN")} paid man-days` },
        { label: "Labour as % of receipts", value: t ? formatPercent(t.receipts ? (t.gross / t.receipts) * 100 : 0) : "", sub: t && `Receipts ${formatINRCompact(t.receipts)}` },
      ]}
      chart={
        data && (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 12, fill: "#344054" }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "#475467" }} tickFormatter={(v: number) => formatINRCompact(v)} />
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="basic" name="Basic" stackId="a" fill="var(--brand-400)" maxBarSize={40} />
                <Bar dataKey="overtime" name="Overtime" stackId="a" fill="var(--brand-700)" maxBarSize={40} />
                <Bar dataKey="bonus" name="Bonus" stackId="a" fill="var(--chart-income)" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }
      sections={
        data
          ? [
              { title: "By department", description: "Months with payroll in BoxERP · gross includes bonus", table: <ReportTable columns={dCols} rows={data.departments} rowKey={(d) => d.department} />, csv: tableToCsv(dCols, data.departments) },
              { title: "By month", table: <ReportTable columns={mCols} rows={data.months} rowKey={(m) => m.month} />, csv: tableToCsv(mCols, data.months) },
            ]
          : [{ title: "By department", table: null }, { title: "By month", table: null }]
      }
      notes={<p>Labour cost is what workers earned (payroll gross), including the current month's estimate. Months marked <i>cash basis</i> pre-date payroll in BoxERP and use salary cash paid instead, so they have no department split.</p>}
    />
  );
}
