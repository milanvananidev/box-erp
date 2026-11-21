import { Badge } from "@/components/ui/badge";
import { formatINR, fromPaise } from "@/lib/format";
import { usePayrollReport, type PayrollReportRow } from "../api";
import { monthLabel, type ReportRange } from "../range";
import { ReportShell } from "./ReportShell";
import { ReportTable, tableToCsv, type RCol } from "./ReportTable";

export function PayrollReportView({ range }: { range: ReportRange }) {
  const { data, isLoading, error, refetch } = usePayrollReport(range);
  const rows = data ?? [];
  const s = (k: keyof PayrollReportRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const money = (k: keyof PayrollReportRow) => ({ total: formatINR(s(k)), totalCsv: fromPaise(s(k)) });

  const cols: RCol<PayrollReportRow>[] = [
    { header: "Month", cell: (r) => <span className="font-medium">{monthLabel(r.month)}</span>, csv: (r) => r.month },
    {
      header: "Status",
      cell: (r) => (r.untracked ? <Badge tone="outline">Before BoxERP</Badge> : r.inProgress ? <Badge tone="info">In progress</Badge> : r.status === "finalized" ? (r.pending ? <Badge tone="warning">Part paid</Badge> : <Badge tone="success">Paid</Badge>) : <Badge tone="neutral">Not finalised</Badge>),
      csv: (r) => (r.untracked ? "Before BoxERP" : r.inProgress ? "In progress" : r.status === "finalized" ? (r.pending ? "Part paid" : "Paid") : "Not finalised"),
    },
    { header: "Workers", align: "right", cell: (r) => r.workers || "—", csv: (r) => r.workers },
    { header: "Gross", align: "right", cell: (r) => formatINR(r.gross), csv: (r) => fromPaise(r.gross), ...money("gross") },
    {
      header: "Deductions", align: "right",
      cell: (r) => (r.advance + r.other ? <span>{formatINR(r.advance + r.other)}{r.other > 0 && <span className="block text-xs text-muted-foreground">adv {formatINR(r.advance)} · other {formatINR(r.other)}</span>}</span> : "—"),
      csv: (r) => fromPaise(r.advance + r.other), total: formatINR(s("advance") + s("other")), totalCsv: fromPaise(s("advance") + s("other")),
    },
    { header: "Net pay", align: "right", cell: (r) => <b>{formatINR(r.net)}</b>, csv: (r) => fromPaise(r.net), ...money("net") },
    { header: "Paid", align: "right", cell: (r) => formatINR(r.paid), csv: (r) => fromPaise(r.paid), ...money("paid") },
    { header: "Pending", align: "right", cell: (r) => (r.pending ? <span className="font-medium text-warning-foreground">{formatINR(r.pending)}</span> : "—"), csv: (r) => fromPaise(r.pending), ...money("pending") },
  ];

  return (
    <ReportShell
      id="payroll"
      title="Payroll Register"
      range={range}
      isLoading={isLoading}
      error={error}
      onRetry={() => refetch()}
      kpis={[
        { label: "Gross salaries", value: formatINR(s("gross")) },
        { label: "Deductions", value: formatINR(s("advance") + s("other")), sub: `Advance ${formatINR(s("advance"))}` },
        { label: "Net paid", value: formatINR(s("paid")), tone: "good" },
        { label: "Pending payout", value: formatINR(s("pending")), tone: s("pending") ? "bad" : undefined, sub: "Finalised, not yet paid" },
      ]}
      sections={[{ title: "By month", description: "Drafts and the current month are live estimates", table: <ReportTable columns={cols} rows={rows} rowKey={(r) => r.month} />, csv: tableToCsv(cols, rows) }]}
      notes={<p>For worker-wise detail, open the month in Payroll and use Export there.</p>}
    />
  );
}
