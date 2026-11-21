import { Suspense } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
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
    <div className="no-print flex items-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-1 text-xs text-warning-foreground">
      <span className="font-semibold">{data?.configured ? "Can't reach database." : "Database not connected."}</span>
      <span className="text-[#5f4a00] truncate">{data?.error ?? "Financial transactions require a live connection."}</span>
      <Link to="/settings" className="ml-auto font-medium underline underline-offset-2">Settings</Link>
    </div>
  );
}

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none">
      <GlobalHotkeys />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <DbBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="h-full w-full p-4 lg:p-5">
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
        {/* Sleek Native Desktop Status Bar */}
        <footer className="no-print flex h-6 shrink-0 select-none items-center justify-between border-t border-border bg-card/70 px-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="font-medium text-foreground/80">BoxERP v0.1.0</span>
            <span className="text-border">|</span>
            <span>Desktop Workspace</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Developed by</span>
            <a
              href="https://www.dhyeytechnologies.in/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-700 hover:text-brand-800 hover:underline transition-colors cursor-pointer inline-flex items-center gap-0.5"
            >
              Dhyey Technologies <ExternalLink className="size-2.5 inline" />
            </a>
          </div>
        </footer>
      </div>
      <CommandPalette />
      <TransactionSheet />
    </div>
  );
}
