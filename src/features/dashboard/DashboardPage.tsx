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
    <div className="flex flex-col gap-4 select-none pb-4">
      {/* HUD Tier 1: 4 Top KPI Cards */}
      <KpiRow />

      {/* Desktop Workstation Layout: 8 cols Financial & Cashflow + 4 cols Factory Operations */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Left Column (8 cols): Cash Flow Analytics & Financial Ledger */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-4">
          <CashMovementCard />
          <RecentTransactionsCard />
        </div>

        {/* Right Column (4 cols): Shopfloor Operations, HR & Raw Material Inventory */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
          <OperationalAlertsCard />
          <WorkerOverviewCard />
          <InventoryOverviewCard />
        </div>
      </div>
    </div>
  );
}
