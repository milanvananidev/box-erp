import { Bell, ChevronDown, Keyboard, LogOut, Search, Settings, PackageX, CalendarClock, ArrowDownLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { usePageMetaStore } from "@/hooks/use-page-meta";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { useUI } from "@/stores/ui";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAlerts } from "@/features/alerts/api";
import { cn } from "@/lib/utils";

function NotificationsButton() {
  const { data: alerts = [] } = useAlerts();
  const navigate = useNavigate();
  return (
    <Popover.Root>
      <Popover.Trigger
        className="relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer hover:bg-black/5 hover:text-foreground focus-visible:outline-none"
        aria-label={`Notifications (${alerts.length})`}
      >
        <Bell className="size-3.5" />
        {alerts.length > 0 && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-danger ring-1 ring-card" />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-80 rounded-lg border border-border bg-popover shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold">
            <span>Alerts</span>
            <span className="text-[11px] font-normal text-muted-foreground">{alerts.length} require attention</span>
          </div>
          <ul className="max-h-72 overflow-y-auto p-1">
            {alerts.length === 0 && (
              <li className="px-3 py-5 text-center text-xs text-muted-foreground">You're all caught up.</li>
            )}
            {alerts.map((a) => (
              <li key={a.id}>
                <Popover.Close asChild>
                  <button
                    onClick={() => navigate(a.href)}
                    className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-muted text-xs cursor-pointer"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded",
                        a.kind === "low_stock"
                          ? "bg-danger-soft text-danger-foreground"
                          : "bg-warning-soft text-warning-foreground",
                      )}
                    >
                      {a.kind === "low_stock" ? <PackageX className="size-3" /> : <CalendarClock className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{a.title}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">{a.detail}</span>
                    </span>
                  </button>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Topbar() {
  const { title } = usePageMetaStore();
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const openTxnSheet = useUI((s) => s.openTxnSheet);
  const navigate = useNavigate();

  return (
    <header
      className="no-print flex h-10 shrink-0 select-none items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md"
      data-tauri-drag-region
    >
      {/* Window / App Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0" data-tauri-drag-region>
        <span className="text-xs font-bold tracking-tight text-foreground/90">BoxERP</span>
        <span className="text-muted-foreground/60 text-xs">/</span>
        <span className="truncate text-xs font-medium text-muted-foreground">{title || "Factory Overview"}</span>
      </div>

      <div className="flex-1" data-tauri-drag-region />

      {/* Compact Native Search Bar */}
      <button
        onClick={() => setCommandOpen(true)}
        className="flex h-7 w-52 items-center gap-2 rounded-md border border-border bg-subtle/80 px-2.5 text-left text-xs text-muted-foreground shadow-2xs transition-colors cursor-pointer hover:border-border hover:bg-muted focus-visible:outline-none"
      >
        <Search className="size-3 text-muted-foreground" />
        <span className="flex-1 truncate text-[11px]">Search ERP...</span>
        <Kbd className="h-4.5 px-1.5 text-[10px]">{modKeyLabel}K</Kbd>
      </button>

      {/* Quick Action Pills */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => openTxnSheet("in")}
          className="flex h-7 items-center gap-1 rounded-md border border-emerald-300/80 bg-emerald-50/70 px-2 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer shadow-2xs"
          title="Add Income (⌘+Shift+I)"
        >
          <ArrowDownLeft className="size-3 text-emerald-600" /> Income
        </button>
        <button
          onClick={() => openTxnSheet("out")}
          className="flex h-7 items-center gap-1 rounded-md border border-rose-300/80 bg-rose-50/70 px-2 text-[11px] font-semibold text-rose-800 transition-colors hover:bg-rose-100 cursor-pointer shadow-2xs"
          title="Add Expense (⌘+Shift+E)"
        >
          <Plus className="size-3 text-rose-600" /> Expense
        </button>
      </div>

      <div className="h-4 w-px bg-border/80" />

      {/* Notifications */}
      <NotificationsButton />

      {/* Compact User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md p-1 outline-none cursor-pointer hover:bg-black/5">
          <span className="flex size-5.5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white shadow-2xs">
            A
          </span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 text-xs">
          <DropdownMenuLabel>
            <div className="font-semibold text-foreground">Admin</div>
            <div className="text-[11px] text-muted-foreground font-normal">Factory Workspace</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/settings")} className="cursor-pointer">
            <Settings className="size-3.5" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCommandOpen(true)} className="cursor-pointer">
            <Keyboard className="size-3.5" /> Keyboard shortcuts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-muted-foreground">
            <LogOut className="size-3.5" /> Lock App
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
