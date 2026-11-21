import { useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/states";
import { ReportTable, tableToCsv, type RCol } from "@/features/reports/components/ReportTable";
import { downloadCsv } from "@/lib/csv";
import { formatINR, formatPercent, formatQty, fromPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UNIT_LABEL, useConsumption, type ConsumptionReport } from "../api";

type Period = "this" | "last" | "three";
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function ConsumptionPanel() {
  const [period, setPeriod] = useState<Period>("this");
  const [from, to] = useMemo(() => {
    const now = new Date();
    if (period === "last") { const m = subMonths(now, 1); return [iso(startOfMonth(m)), iso(endOfMonth(m))]; }
    if (period === "three") return [iso(startOfMonth(subMonths(now, 2))), iso(now)];
    return [iso(startOfMonth(now)), iso(now)];
  }, [period]);
  const { data, isLoading, error, refetch } = useConsumption(from, to);

  type M = ConsumptionReport["byMaterial"][number];
  type O = ConsumptionReport["byOrder"][number];
  const totalValue = data?.byMaterial.reduce((s, r) => s + r.value, 0) ?? 0;
  const mCols: RCol<M>[] = [
    { header: "Material", cell: (r) => <span><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">{r.code}</span></span>, csv: (r) => `${r.name} (${r.code})` },
    { header: "Received", align: "right", cell: (r) => (r.inward ? formatQty(r.inward, UNIT_LABEL[r.unit as keyof typeof UNIT_LABEL]) : "—"), csv: (r) => r.inward },
    { header: "Issued", align: "right", cell: (r) => <b>{formatQty(r.issued, UNIT_LABEL[r.unit as keyof typeof UNIT_LABEL])}</b>, csv: (r) => r.issued },
    { header: "Issue value", align: "right", cell: (r) => formatINR(r.value), csv: (r) => fromPaise(r.value), total: formatINR(totalValue), totalCsv: fromPaise(totalValue) },
  ];
  const oCols: RCol<O>[] = [
    { header: "Order", cell: (r) => <span className="font-medium">{r.orderNo}</span>, csv: (r) => r.orderNo },
    { header: "Customer / product", cell: (r) => <span>{r.customer} <span className="text-xs text-muted-foreground">{r.product}</span></span>, csv: (r) => `${r.customer} – ${r.product}` },
    { header: "Paper issued", align: "right", cell: (r) => formatQty(r.issuedKg, "kg"), csv: (r) => r.issuedKg },
    { header: "Expected for output", align: "right", cell: (r) => (r.expectedKg ? formatQty(r.expectedKg, "kg") : "—"), csv: (r) => r.expectedKg },
    {
      header: "Variance", align: "right",
      cell: (r) => r.variancePct == null ? <span className="text-muted-foreground">—</span> : (
        <span className={cn("font-medium", r.variancePct > 10 ? "text-danger-foreground" : r.variancePct < -10 ? "text-warning-foreground" : "text-success-foreground")}>
          {r.variancePct > 0 ? "+" : ""}{formatPercent(r.variancePct)}
        </span>
      ),
      csv: (r) => (r.variancePct == null ? "" : r.variancePct.toFixed(1)),
    },
    { header: "Value", align: "right", cell: (r) => formatINR(r.value), csv: (r) => fromPaise(r.value) },
  ];

  const exportAll = () => {
    if (!data) return;
    const a = tableToCsv(mCols, data.byMaterial), b = tableToCsv(oCols, data.byOrder);
    downloadCsv(`consumption-${from}_${to}`, [], [["Material consumption"], a.header, ...a.rows, [], ["Paper usage by order"], b.header, ...b.rows]);
    toast.success("Exported consumption");
  };

  if (error) return <Card><ErrorState error={error} onRetry={() => refetch()} /></Card>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="this">This month</TabsTrigger>
            <TabsTrigger value="last">Last month</TabsTrigger>
            <TabsTrigger value="three">Last 3 months</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" disabled={!data} onClick={exportAll}><Download /> Export CSV</Button>
      </div>
      <Card className="overflow-hidden">
        <div className="px-5 pt-4 pb-3"><h3 className="font-semibold">Material consumption</h3><p className="text-[13px] text-muted-foreground">Received and issued in the period, valued at average cost</p></div>
        {isLoading || !data ? <div className="space-y-2 px-5 pb-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div> : <ReportTable columns={mCols} rows={data.byMaterial} rowKey={(r) => r.materialId} />}
      </Card>
      <Card className="overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <h3 className="font-semibold">Paper usage by production order</h3>
          <p className="text-[13px] text-muted-foreground">Paper issued vs the estimate for pieces actually made (good + wastage). Large positive variance means unrecorded wastage or over-issue.</p>
        </div>
        {isLoading || !data ? <div className="space-y-2 px-5 pb-5">{[0, 1].map((i) => <Skeleton key={i} className="h-8" />)}</div> : <ReportTable columns={oCols} rows={data.byOrder} rowKey={(r) => r.orderId} emptyText="No paper issued against orders in this period" />}
      </Card>
    </div>
  );
}
