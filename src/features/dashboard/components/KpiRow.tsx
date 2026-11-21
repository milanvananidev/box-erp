import { ArrowDownToLine, ArrowUpRight, Package, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/shared/StatCard";
import { formatINR, formatQty, formatPercent } from "@/lib/format";
import { useDashboardSummary } from "../api";

export function KpiRow() {
  const { data, isLoading } = useDashboardSummary();
  const navigate = useNavigate();
  const att = data?.attendance;
  const present = att ? att.present + att.halfDay : 0;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        label="Cash In"
        icon={ArrowDownToLine}
        tone="success"
        loading={isLoading}
        value={data && formatINR(data.cashIn.value)}
        changePct={data?.cashIn.changePct}
        comparison="vs last month"
        onClick={() => navigate("/finance?direction=in")}
      />
      <StatCard
        label="Cash Out"
        icon={ArrowUpRight}
        tone="danger"
        loading={isLoading}
        value={data && formatINR(data.cashOut.value)}
        changePct={data?.cashOut.changePct}
        goodWhenUp={false}
        comparison="vs last month"
        onClick={() => navigate("/finance?direction=out")}
      />
      <StatCard
        label="Production (Today)"
        icon={Package}
        tone="info"
        loading={isLoading}
        value={data && formatQty(data.productionToday.value, "pcs")}
        changePct={data?.productionToday.changePct}
        comparison="vs yesterday"
        onClick={() => navigate("/production")}
      />
      <StatCard
        label="Workers Present"
        icon={Users}
        tone="violet"
        loading={isLoading}
        value={att && `${present} / ${att.total}`}
        footnote={att && `${formatPercent((present / Math.max(att.total, 1)) * 100)} attendance`}
        onClick={() => navigate("/workers")}
      />
    </div>
  );
}
