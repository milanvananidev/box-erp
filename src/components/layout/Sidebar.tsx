import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Boxes } from "lucide-react";
import { navGroups, settingsNav, type NavItem } from "@/lib/nav";
import { useUI } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { isMac, isTauri } from "@/lib/env";

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Hint
      side="right"
      disabled={!collapsed}
      label={
        <span className="flex items-center gap-2">
          {item.label}
          {item.hotkey && <span className="text-muted-foreground">{modKeyLabel}{item.hotkey}</span>}
        </span>
      }
    >
      <NavLink
        to={item.to}
        end={item.to === "/"}
        className={({ isActive }) =>
          cn(
            "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-xs font-medium transition-all outline-none cursor-pointer",
            collapsed && "justify-center px-0 h-8.5",
            isActive
              ? "bg-white text-brand-900 shadow-2xs border border-border/70 font-semibold"
              : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground",
          )
        }
      >
        <Icon className="size-4 shrink-0 transition-colors" strokeWidth={1.9} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    </Hint>
  );
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  const hasMacTrafficLights = isMac && isTauri();

  return (
    <aside
      className={cn(
        "no-print relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar select-none border-r border-sidebar-border transition-[width] duration-150 ease-out",
        collapsed ? "w-14" : "w-52",
      )}
    >
      {/* Native App Sidebar Header - 40px aligned with Topbar, with Mac traffic light avoidance */}
      <div
        className={cn(
          "flex h-10 shrink-0 items-center border-b border-sidebar-border px-3",
          hasMacTrafficLights && (collapsed ? "pt-2 justify-center" : "pl-18 gap-2"),
          !hasMacTrafficLights && (collapsed ? "justify-center px-0" : "gap-2.5"),
        )}
        data-tauri-drag-region
      >
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-2xs">
          <Boxes className="size-3.5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0" data-tauri-drag-region>
            <span className="text-xs font-bold tracking-tight text-foreground leading-tight truncate">
              BoxERP
            </span>
            <span className="text-[10px] text-muted-foreground leading-none truncate">
              Packaging Workspace
            </span>
          </div>
        )}
      </div>

      {/* Nav List */}
      <nav className={cn("relative z-10 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-2", collapsed && "px-1.5")}>
        {navGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                <div className="mx-auto my-1.5 h-px w-5 bg-sidebar-border" />
              ) : (
                <div className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                </div>
              ))}
            {group.items.map((item) => (
              <NavEntry key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
        <div className={cn("mt-auto border-t border-sidebar-border pt-2")}>
          <NavEntry item={settingsNav} collapsed={collapsed} />
        </div>
      </nav>

      {/* Sidebar Footer Controls */}
      <div className={cn("relative z-10 border-t border-sidebar-border p-2", collapsed && "px-1.5")}>
        <Hint side="right" label={`${collapsed ? "Expand" : "Collapse"} sidebar (${modKeyLabel}B)`}>
          <button
            onClick={toggle}
            className={cn(
              "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[11px] text-muted-foreground transition-colors cursor-pointer hover:bg-black/[0.04] hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
            {!collapsed && <span>Collapse Sidebar</span>}
          </button>
        </Hint>
      </div>
    </aside>
  );
}
