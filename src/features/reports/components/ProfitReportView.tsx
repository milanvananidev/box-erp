import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { formatINR, formatINRCompact, formatPercent, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useProfitReport, type CategoryRow, type ProfitMonth } from "../api";
import { monthLabel, type ReportRange } from "../range";
import { ReportShell } from "./ReportShell";
import { ReportTable, tableToCsv, type RCol } from "./ReportTable";

const TREATMENT_LABEL = { operating: "Operating", advance: "Advance", capital: "Capital", loan: "Loan", transfer: "Transfer" } as const;
const money = (v: number) => formatINR(v);

export function ProfitReportView({ range }: { range: ReportRange }) {
  const { data, isLoading, error, refetch } = useProfitReport(range);
  const t = data?.totals;
  const margin = t && t.receipts ? (t.profit / t.receipts) * 100 : 0;

  const monthCols: RCol<ProfitMonth>[] = [
    { header: "Month", cell: (m) => <span className="font-medium">{monthLabel(m.month)}</span>, csv: (m) => m.month },
    { header: "Receipts", align: "right", cell: (m) => money(m.receipts), csv: (m) => fromPaise(m.receipts), total: t && money(t.receipts), totalCsv: t && fromPaise(t.receipts) },
    { header: "Raw material", align: "right", cell: (m) => money(m.materials), csv: (m) => fromPaise(m.materials), total: t && money(t.materials), totalCsv: t && fromPaise(t.materials) },
    {
      header: "Labour cost", align: "right",
      cell: (m) => (
        <span className="inline-flex items-center gap-1.5">
          {m.labourBasis === "cash" && <Hint label="No payroll in BoxERP for this month. Using salary cash paid instead."><Badge tone="outline">cash</Badge></Hint>}
          {money(m.labour)}
        </span>
      ),
      csv: (m) => fromPaise(m.labour), total: t && money(t.labour), totalCsv: t && fromPaise(t.labour),
    },
    { header: "Overheads", align: "right", cell: (m) => money(m.overheads), csv: (m) => fromPaise(m.overheads), total: t && money(t.overheads), totalCsv: t && fromPaise(t.overheads) },
    {
      header: "Operating profit", align: "right",
      cell: (m) => <span className={cn("font-semibold", m.profit < 0 && "text-danger-foreground")}>{formatINR(m.profit, { sign: true })}</span>,
      csv: (m) => fromPaise(m.profit), total: t && formatINR(t.profit, { sign: true }), totalCsv: t && fromPaise(t.profit),
    },
    { header: "Margin", align: "right", cell: (m) => (m.receipts ? formatPercent((m.profit / m.receipts) * 100) : "—"), csv: (m) => (m.receipts ? ((m.profit / m.receipts) * 100).toFixed(1) : "") , total: t && formatPercent(margin) },
  ];

  const catCols: RCol<CategoryRow>[] = [
    { header: "Category", cell: (c) => <span className="font-medium">{c.category}</span>, csv: (c) => c.category },
    { header: "Type", cell: (c) => (c.direction === "in" ? <Badge tone="success">In</Badge> : <Badge tone="danger">Out</Badge>), csv: (c) => (c.direction === "in" ? "In" : "Out") },
    { header: "Treatment", cell: (c) => <span className={cn(c.treatment !== "operating" && "text-muted-foreground")}>{TREATMENT_LABEL[c.treatment]}</span>, csv: (c) => TREATMENT_LABEL[c.treatment] },
    { header: "Entries", align: "right", cell: (c) => c.count },
    { header: "Amount", align: "right", cell: (c) => money(c.amount), csv: (c) => fromPaise(c.amount) },
  ];

  return (
    <ReportShell
      id="profit"
      title="Income vs Expenses"
      range={range}
      isLoading={isLoading}
      error={error}
      onRetry={() => refetch()}
      kpis={[
        { label: "Operating receipts", value: t ? money(t.receipts) : "", sub: "Customer payments + scrap sales" },
        { label: "Operating costs", value: t ? money(t.materials + t.labour + t.overheads) : "", sub: t && `Material ${formatINRCompact(t.materials)} · Labour ${formatINRCompact(t.labour)} · Other ${formatINRCompact(t.overheads)}` },
        { label: "Operating profit (est.)", value: t ? formatINR(t.profit, { sign: true }) : "", sub: t && `${formatPercent(margin)} margin`, tone: t && (t.profit >= 0 ? "good" : "bad") },
        { label: "Operating cash surplus", value: t ? formatINR(t.operatingCash, { sign: true }) : "", sub: "Same items on cash basis, labour as paid" },
      ]}
      chart={
        data && (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.months.map((m) => ({ ...m, label: monthLabel(m.month), costs: m.materials + m.labour + m.overheads }))} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 12, fill: "#344054" }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "#475467" }} tickFormatter={(v: number) => formatINRCompact(v)} />
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="receipts" name="Receipts" fill="var(--chart-income)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey="costs" name="Operating costs" fill="var(--chart-expense)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Line dataKey="profit" name="Operating profit" stroke="var(--brand-600)" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )
      }
      sections={
        data
          ? [
              { title: "Monthly summary", table: <ReportTable columns={monthCols} rows={data.months} rowKey={(m) => m.month} />, csv: tableToCsv(monthCols, data.months) },
              { title: "By category", description: "All cash movements in the period, including non-operating items", table: <ReportTable dense columns={catCols} rows={data.categories} rowKey={(c) => `${c.direction}-${c.category}`} />, csv: tableToCsv(catCols, data.categories) },
            ]
          : [{ title: "Monthly summary", table: null }, { title: "By category", table: null }]
      }
      notes={
        <>
          <p><b>Operating profit</b> = operating receipts − raw material − labour cost − overheads. Labour cost is the payroll <i>gross</i> for the month (what was earned), not salary cash paid, so advances and payout timing don't distort it.</p>
          <p>Salary advances, machinery (capital), loans and transfers are excluded from profit but appear in the Cash Flow report. Sales are as received. Invoicing and GST stay in Vyapar, so this is a management estimate, not your books of account.</p>
        </>
      }
    />
  );
}
