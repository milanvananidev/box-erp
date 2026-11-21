import { Suspense } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { dataSource } from "@/lib/env";
import { useDbStatus } from "@/features/settings/api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { TransactionSheet } from "@/features/finance/components/TransactionSheet";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { allNavItems } from "@/lib/nav";
import { useUI } from "@/stores/ui";
import { PageLoader } from "@/components/shared/states";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

function GlobalHotkeys() {
  const navigate = useNavigate();
  const { toggleSidebar, setCommandOpen, openTxnSheet } = useUI.getState();
  const navKeys = Object.fromEntries(
    allNavItems.filter((i) => i.hotkey).map((i) => [`mod+${i.hotkey}`, () => navigate(i.to)]),
  );
  useHotkeys({
    "mod+k": () => setCommandOpen(!useUI.getState().commandOpen),
    "mod+b": toggleSidebar,
    "mod+shift+e": () => openTxnSheet("out"),
    "mod+shift+i": () => openTxnSheet("in"),
    ...navKeys,
  });
  return null;
}

/** In live mode, tells the user when the database isn't reachable. */
function DbBanner() {
  const { data, isLoading } = useDbStatus();
  if (dataSource !== "tauri" || isLoading || data?.connected) return null;
  return (
    <div className="no-print flex items-center gap-3 border-b border-warning/30 bg-warning-soft px-7 py-2 text-[13px] text-warning-foreground">
      <span className="font-medium">{data?.configured ? "Can't reach the database." : "Database not set up on this computer."}</span>
      <span className="text-[#5f4a00]">{data?.error ?? "Income & Expenses and Workers screens need it."}</span>
      <Link to="/settings" className="ml-auto font-medium underline underline-offset-2">Open Settings</Link>
    </div>
  );
}

export function AppShell() {
  return (
    <div className="flex h-full overflow-hidden">
      <GlobalHotkeys />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <DbBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1680px] px-5 py-5 xl:px-6">
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette />
      <TransactionSheet />
    </div>
  );
}
