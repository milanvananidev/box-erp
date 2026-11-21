import { Bell, ChevronDown, Keyboard, LogOut, Search, Settings, PackageX, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { usePageMetaStore } from "@/hooks/use-page-meta";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { useUI } from "@/stores/ui";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAlerts } from "@/features/alerts/api";
import { cn } from "@/lib/utils";

function NotificationsButton() {
  const { data: alerts = [] } = useAlerts();
  const navigate = useNavigate();
  return (
    <Popover.Root>
      <Popover.Trigger
        className="relative flex size-10 items-center justify-center rounded-full text-[#475467] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`Notifications (${alerts.length})`}
      >
        <Bell className="size-[22px]" strokeWidth={1.75} />
        {alerts.length > 0 && (
          <span className="absolute top-1.5 right-2 size-2.5 rounded-full bg-danger ring-2 ring-card" />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[360px] rounded-xl border border-border bg-popover shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Alerts</span>
            <span className="text-xs text-muted-foreground">{alerts.length} need attention</span>
          </div>
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {alerts.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</li>}
            {alerts.map((a) => (
              <li key={a.id}>
                <Popover.Close asChild>
                  <button
                    onClick={() => navigate(a.href)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        a.kind === "low_stock" ? "bg-danger-soft text-danger-foreground" : "bg-warning-soft text-warning-foreground",
                      )}
                    >
                      {a.kind === "low_stock" ? <PackageX className="size-4" /> : <CalendarClock className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{a.title}</span>
                      <span className="block text-xs text-muted-foreground">{a.detail}</span>
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
  const { title, subtitle } = usePageMetaStore();
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const navigate = useNavigate();

  return (
    <header className="no-print flex h-[92px] shrink-0 items-center gap-6 border-b border-border bg-card px-7" data-tauri-drag-region>
      <div className="min-w-0 flex-1" data-tauri-drag-region>
        <h1 className="truncate text-[28px] leading-tight font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="truncate text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="flex h-11 w-[min(420px,32vw)] items-center gap-3 rounded-xl border border-border bg-card px-3.5 text-left text-[15px] text-[#667085] shadow-xs transition-colors hover:border-[#cfd4dc] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-100"
      >
        <Search className="size-[18px] text-[#475467]" />
        <span className="flex-1 truncate">Search workers, materials, costing…</span>
        <Kbd className="h-6 px-2 text-xs">{modKeyLabel} + K</Kbd>
      </button>

      <NotificationsButton />

      <div className="h-8 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-full py-1 pr-2 pl-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50">
          <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-[17px] font-semibold text-white">
            AS
          </span>
          <span className="text-[17px] font-semibold">Admin</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="text-sm font-semibold text-foreground">Admin</div>
            <div className="text-xs font-normal">Factory owner</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/settings")}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCommandOpen(true)}>
            <Keyboard /> Keyboard shortcuts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <LogOut /> Lock app
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
