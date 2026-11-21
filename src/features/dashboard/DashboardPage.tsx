import { usePageMeta } from "@/hooks/use-page-meta";
import { formatDayLong } from "@/lib/format";
import { TODAY } from "@/data/mock/seed";
import { KpiRow } from "./components/KpiRow";
import { CashMovementCard } from "./components/CashMovementCard";
import { OperationalAlertsCard } from "./components/OperationalAlertsCard";
import { WorkerOverviewCard } from "./components/WorkerOverviewCard";
import { InventoryOverviewCard } from "./components/InventoryOverviewCard";
import { RecentTransactionsCard } from "./components/RecentTransactionsCard";

export default function DashboardPage() {
  usePageMeta("Factory Dashboard", `Factory overview • ${formatDayLong(TODAY)}`);

  return (
    <div className="flex flex-col gap-5">
      {/* Tier 1: 4 Top KPI Cards */}
      <KpiRow />

      {/* Tier 2: Cash Movement Bar Chart & Operational Alerts */}
      <div className="grid grid-cols-12 gap-5 items-stretch">
        <CashMovementCard className="col-span-12 lg:col-span-7 xl:col-span-8" />
        <OperationalAlertsCard className="col-span-12 lg:col-span-5 xl:col-span-4" />
      </div>

      {/* Tier 3: 3 Operational Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        <WorkerOverviewCard />
        <InventoryOverviewCard />
        <RecentTransactionsCard />
      </div>
    </div>
  );
}
