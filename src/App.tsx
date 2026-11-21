import { lazy } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/shared/states";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import DashboardPage from "@/features/dashboard/DashboardPage";

// Modules other than the dashboard load on demand to keep start-up fast.
const FinancePage = lazy(() => import("@/features/finance/FinancePage"));
const CostingPage = lazy(() => import("@/features/costing/CostingPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const InventoryPage = lazy(() => import("@/features/inventory/InventoryPage"));
const WorkersPage = lazy(() => import("@/features/workers/WorkersPage"));
const PayrollPage = lazy(() => import("@/features/payroll/PayrollPage"));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "finance", element: <FinancePage /> },
      { path: "costing", element: <CostingPage /> },
      { path: "production", element: <Navigate to="/costing" replace /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "workers", element: <WorkersPage /> },
      { path: "payroll", element: <PayrollPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      {
        path: "*",
        element: (
          <EmptyState icon={MapPinOff} title="Page not found" description="This screen doesn't exist."
            action={<Button asChild variant="outline" size="sm"><Link to="/">Back to dashboard</Link></Button>} />
        ),
      },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
