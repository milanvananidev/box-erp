import {
  LayoutDashboard, Factory, Boxes, Users, Wallet, ArrowLeftRight, BarChart3, Settings, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Digit used with Ctrl/⌘ to jump to the page */
  hotkey?: string;
  keywords?: string[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  { items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, hotkey: "1", keywords: ["home", "overview"] }] },
  {
    label: "Operations",
    items: [
      { to: "/production", label: "Production", icon: Factory, hotkey: "2", keywords: ["orders", "jobs", "wastage", "box"] },
      { to: "/inventory", label: "Inventory", icon: Boxes, hotkey: "3", keywords: ["raw materials", "paper", "stock", "gum", "ink"] },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/workers", label: "Workers & HR", icon: Users, hotkey: "4", keywords: ["attendance", "employees", "staff"] },
      { to: "/payroll", label: "Payroll", icon: Wallet, hotkey: "5", keywords: ["salary", "wages", "advance", "slip"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/finance", label: "Income & Expenses", icon: ArrowLeftRight, hotkey: "6", keywords: ["transactions", "ledger", "cash", "bank", "upi"] },
      { to: "/reports", label: "Reports", icon: BarChart3, hotkey: "7", keywords: ["cash flow", "summary", "export"] },
    ],
  },
];

export const settingsNav: NavItem = { to: "/settings", label: "Settings", icon: Settings, hotkey: "8", keywords: ["database", "connection"] };

export const allNavItems: NavItem[] = [...navGroups.flatMap((g) => g.items), settingsNav];
