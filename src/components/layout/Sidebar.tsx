import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navGroups, settingsNav, type NavItem } from "@/lib/nav";
import { useUI } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { BrandWordmark, CorrugatedArt } from "./BrandMark";

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Hint
      side="right"
      disabled={!collapsed}
      label={
        <span className="flex items-center gap-2">
          {item.label}
          {item.hotkey && <span className="text-white/50">{modKeyLabel}{item.hotkey}</span>}
        </span>
      }
    >
      <NavLink
        to={item.to}
        end={item.to === "/"}
        className={({ isActive }) =>
          cn(
            "group relative flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-medium transition-colors outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-400/60",
            collapsed && "justify-center px-0",
            isActive
              ? "bg-gradient-to-r from-sidebar-active-from to-sidebar-active-to text-white shadow-[0_6px_16px_-6px_rgba(201,143,79,.55)]"
              : "text-sidebar-foreground/85 hover:bg-sidebar-elevated hover:text-white",
          )
        }
      >
        <Icon className="size-[20px] shrink-0" strokeWidth={1.75} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    </Hint>
  );
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "no-print relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-[76px]" : "w-[256px]",
      )}
    >
      <div className={cn("flex h-[92px] items-center px-5", collapsed && "justify-center px-0")} data-tauri-drag-region>
        <BrandWordmark collapsed={collapsed} />
      </div>

      <nav className={cn("relative z-10 flex flex-1 flex-col gap-1 overflow-y-auto px-3.5 pt-2", collapsed && "px-3")}>
        {navGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {group.label &&
              (collapsed ? (
                <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />
              ) : (
                <div className="px-3.5 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-muted/80 uppercase">
                  {group.label}
                </div>
              ))}
            {group.items.map((item) => (
              <NavEntry key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
        <div className={cn("mt-3 border-t border-sidebar-border pt-3")}>
          <NavEntry item={settingsNav} collapsed={collapsed} />
        </div>
      </nav>

      {!collapsed && <CorrugatedArt className="pointer-events-none absolute bottom-0 left-0 opacity-90" />}

      <div className={cn("relative z-10 p-3.5", collapsed && "px-3")}>
        <Hint side="right" label={`${collapsed ? "Expand" : "Collapse"} sidebar  ${modKeyLabel}B`}>
          <button
            onClick={toggle}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-sidebar-foreground/80 backdrop-blur-sm transition-colors cursor-pointer hover:bg-sidebar-elevated/80 hover:text-white",
              collapsed && "justify-center px-0",
              !collapsed && "bg-sidebar/60",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && "Collapse"}
          </button>
        </Hint>
      </div>
    </aside>
  );
}
