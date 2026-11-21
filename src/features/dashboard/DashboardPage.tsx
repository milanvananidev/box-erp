import { usePageMeta } from "@/hooks/use-page-meta";
import { formatDayLong } from "@/lib/format";
import { TODAY } from "@/data/mock/seed";
import { KpiRow } from "./components/KpiRow";
import { CashFlowChart } from "./components/CashFlowChart";
import { RecentTransactions } from "./components/RecentTransactions";
import { SalaryPending } from "./components/SalaryPending";
import { QuickActions } from "./components/QuickActions";

export default function DashboardPage() {
  usePageMeta("Dashboard", `Factory Overview  •  ${formatDayLong(TODAY)}`);

  return (
    <div className="flex flex-col gap-5">
      <KpiRow />
      <div className="grid grid-cols-12 gap-5">
        <CashFlowChart className="col-span-12 lg:col-span-7 2xl:col-span-8" />
        <SalaryPending className="col-span-12 lg:col-span-5 2xl:col-span-4" />

        <RecentTransactions className="col-span-12 lg:col-span-7 2xl:col-span-8" />
        <QuickActions className="col-span-12 lg:col-span-5 2xl:col-span-4" />
      </div>
    </div>
  );
}
