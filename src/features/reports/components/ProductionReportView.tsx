import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPercent, formatQty } from "@/lib/format";
import { STAGE_LABEL, WASTAGE_REASONS } from "@/lib/production";
import { cn } from "@/lib/utils";
import { useProductionReport, type ProductionReport } from "../api";
import type { ReportRange } from "../range";
import { ReportShell } from "./ReportShell";
import { ReportTable, tableToCsv, type RCol } from "./ReportTable";

type C = ProductionReport["byCustomer"][number];
type R = ProductionReport["byReason"][number];
type S = ProductionReport["byStage"][number];
type O = ProductionReport["completed"][number];
const wp = (w: number, g: number) => (g + w ? (w / (g + w)) * 100 : 0);

export function ProductionReportView({ range }: { range: ReportRange }) {
  const { data, isLoading, error, refetch } = useProductionReport(range);
  const t = data?.totals;
  const waste = t ? wp(t.wastage, t.good) : 0;

  const cCols: RCol<C>[] = [
    { header: "Customer", cell: (c) => <span className="font-medium">{c.customer}</span>, csv: (c) => c.customer },
    { header: "Orders", align: "right", cell: (c) => c.orders },
    { header: "Good pcs", align: "right", cell: (c) => formatQty(c.good), csv: (c) => c.good, total: t && formatQty(t.good), totalCsv: t?.good },
    { header: "Wastage pcs", align: "right", cell: (c) => formatQty(c.wastage), csv: (c) => c.wastage, total: t && formatQty(t.wastage), totalCsv: t?.wastage },
    { header: "Wastage %", align: "right", cell: (c) => <span className={cn(wp(c.wastage, c.good) > 3 && "font-medium text-danger-foreground")}>{formatPercent(wp(c.wastage, c.good))}</span>, csv: (c) => wp(c.wastage, c.good).toFixed(2), total: formatPercent(waste) },
  ];
  const rCols: RCol<R>[] = [
    { header: "Reason", cell: (r) => (r.reason === "unspecified" ? "Not specified" : WASTAGE_REASONS[r.reason]) },
    { header: "Pieces", align: "right", cell: (r) => formatQty(r.qty), csv: (r) => r.qty, total: t && formatQty(t.wastage) },
    { header: "Share", align: "right", cell: (r) => formatPercent(t?.wastage ? (r.qty / t.wastage) * 100 : 0), csv: (r) => (t?.wastage ? ((r.qty / t.wastage) * 100).toFixed(1) : "") },
  ];
  const sCols: RCol<S>[] = [
    { header: "Stage", cell: (s) => STAGE_LABEL[s.stage] },
    { header: "Good pcs", align: "right", cell: (s) => formatQty(s.good), csv: (s) => s.good },
    { header: "Wastage %", align: "right", cell: (s) => formatPercent(wp(s.wastage, s.good)), csv: (s) => wp(s.wastage, s.good).toFixed(2) },
  ];
  const oCols: RCol<O>[] = [
    { header: "Order", cell: (o) => <span className="font-medium">{o.orderNo}</span>, csv: (o) => o.orderNo },
    { header: "Customer", cell: (o) => o.customer },
    { header: "Product", cell: (o) => o.product },
    { header: "Planned", align: "right", cell: (o) => formatQty(o.plannedQty), csv: (o) => o.plannedQty },
    { header: "Produced", align: "right", cell: (o) => formatQty(o.producedQty), csv: (o) => o.producedQty },
    { header: "Wastage %", align: "right", cell: (o) => formatPercent(wp(o.wastageQty, o.producedQty)), csv: (o) => wp(o.wastageQty, o.producedQty).toFixed(2) },
    { header: "Due", cell: (o) => formatDate(o.dueDate), csv: (o) => o.dueDate },
    { header: "Completed", cell: (o) => formatDate(o.completedOn), csv: (o) => o.completedOn },
    { header: "On time", cell: (o) => (o.lateDays ? <Badge tone="danger">{o.lateDays}d late</Badge> : <Badge tone="success">On time</Badge>), csv: (o) => (o.lateDays ? `${o.lateDays} days late` : "On time") },
  ];

  return (
    <ReportShell
      id="production"
      title="Production Summary"
      range={range}
      isLoading={isLoading}
      error={error}
      onRetry={() => refetch()}
      kpis={[
        { label: "Good pieces", value: t ? formatQty(t.good) : "", sub: t && `${t.activeOrders} orders still active` },
        { label: "Wastage", value: formatPercent(waste), tone: waste > 3 ? "bad" : "good", sub: t && `${formatQty(t.wastage)} pcs · target under 3%` },
        { label: "Orders completed", value: t ? String(t.ordersCompleted) : "" },
        { label: "On-time delivery", value: t && t.ordersCompleted ? formatPercent((t.onTime / t.ordersCompleted) * 100, 0) : "—", sub: t && `${t.onTime} of ${t.ordersCompleted} by due date` },
      ]}
      chart={
        data && data.daily.length > 0 && (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily.map((d) => ({ ...d, label: format(parseISO(d.date), "d MMM") }))} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 12, fill: "#344054" }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "#475467" }} tickFormatter={(v: number) => formatQty(v)} />
                <Tooltip formatter={(v) => `${formatQty(Number(v))} pcs`} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="good" name="Good pieces" stackId="p" fill="var(--brand-400)" maxBarSize={28} />
                <Bar dataKey="wastage" name="Wastage" stackId="p" fill="var(--danger)" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }
      sections={
        data
          ? [
              { title: "By customer", table: <ReportTable columns={cCols} rows={data.byCustomer} rowKey={(c) => c.customer} />, csv: tableToCsv(cCols, data.byCustomer) },
              { title: "Wastage by reason", table: <ReportTable dense columns={rCols} rows={data.byReason} rowKey={(r) => r.reason} />, csv: tableToCsv(rCols, data.byReason), half: true },
              { title: "Output by stage logged", table: <ReportTable dense columns={sCols} rows={data.byStage} rowKey={(s) => s.stage} />, csv: tableToCsv(sCols, data.byStage), half: true },
              { title: "Completed orders", table: <ReportTable columns={oCols} rows={data.completed} rowKey={(o) => o.orderNo} emptyText="No orders completed in this period" />, csv: tableToCsv(oCols, data.completed) },
            ]
          : [{ title: "By customer", table: null }, { title: "Wastage by reason", table: null, half: true }, { title: "Output by stage logged", table: null, half: true }, { title: "Completed orders", table: null }]
      }
      notes={<p>Based on output logged against production orders. Wastage % = wastage ÷ (good + wastage).</p>}
    />
  );
}
