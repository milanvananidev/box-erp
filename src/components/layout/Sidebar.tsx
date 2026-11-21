import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Boxes } from "lucide-react";
import { navGroups, settingsNav, type NavItem } from "@/lib/nav";
import { useUI } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";
import { modKeyLabel } from "@/hooks/use-hotkeys";

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
            "group relative flex h-7.5 items-center gap-2.5 rounded-md px-2 text-xs font-medium transition-colors outline-none cursor-pointer",
            collapsed && "justify-center px-0",
            isActive
              ? "bg-brand-600 text-white shadow-2xs font-semibold"
              : "text-sidebar-foreground/80 hover:bg-sidebar-elevated hover:text-white",
          )
        }
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.8} />
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
        "no-print relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar select-none border-r border-sidebar-border transition-[width] duration-150 ease-out",
        collapsed ? "w-14" : "w-52",
      )}
    >
      {/* Native App Sidebar Header - 40px aligned with Topbar */}
      <div
        className={cn(
          "flex h-10 shrink-0 items-center border-b border-sidebar-border/60 px-3",
          collapsed ? "justify-center px-0" : "gap-2.5",
        )}
        data-tauri-drag-region
      >
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-2xs">
          <Boxes className="size-3.5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0" data-tauri-drag-region>
            <span className="text-xs font-bold tracking-tight text-white leading-tight truncate">
              BoxERP
            </span>
            <span className="text-[10px] text-sidebar-muted leading-none truncate">
              Packaging ERP
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
                <div className="mx-auto my-1.5 h-px w-5 bg-sidebar-border/80" />
              ) : (
                <div className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-sidebar-muted/70 uppercase">
                  {group.label}
                </div>
              ))}
            {group.items.map((item) => (
              <NavEntry key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
        <div className={cn("mt-2 border-t border-sidebar-border/60 pt-2")}>
          <NavEntry item={settingsNav} collapsed={collapsed} />
        </div>
      </nav>

      {/* Sidebar Footer Controls */}
      <div className={cn("relative z-10 border-t border-sidebar-border/60 p-2", collapsed && "px-1.5")}>
        <Hint side="right" label={`${collapsed ? "Expand" : "Collapse"} sidebar (${modKeyLabel}B)`}>
          <button
            onClick={toggle}
            className={cn(
              "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[11px] text-sidebar-foreground/70 transition-colors cursor-pointer hover:bg-sidebar-elevated hover:text-white",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </Hint>

        {!collapsed && (
          <div className="mt-1.5 px-2 text-center text-[10px] text-sidebar-foreground/40 leading-none">
            Developed by{" "}
            <a
              href="https://www.dhyeytechnologies.in/"
              target="_blank"
              rel="noreferrer"
              className="text-sidebar-foreground/70 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
            >
              Dhyey Technologies
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
