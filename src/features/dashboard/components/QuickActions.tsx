import type { LucideIcon } from "lucide-react";
import { SquarePlus, Calculator, HandCoins, ReceiptIndianRupee, PackagePlus, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/tooltip";
import { modKeyLabel } from "@/hooks/use-hotkeys";
import { useUI } from "@/stores/ui";
import { cn } from "@/lib/utils";

interface Action {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  shortcut?: string;
}

export function QuickActions({ className }: { className?: string }) {
  const navigate = useNavigate();
  const openTxn = useUI((s) => s.openTxnSheet);

  const actions: Action[] = [
    { label: "Add Income", icon: SquarePlus, onClick: () => openTxn("in"), shortcut: `${modKeyLabel}⇧I` },
    { label: "Add Expense", icon: ReceiptIndianRupee, onClick: () => openTxn("out"), shortcut: `${modKeyLabel}⇧E` },
    { label: "Box Costing", icon: Calculator, onClick: () => navigate("/costing") },
    { label: "Worker Advances", icon: HandCoins, onClick: () => navigate("/workers?tab=advances") },
    { label: "Material Inward", icon: PackagePlus, onClick: () => navigate("/inventory?inward=1") },
    { label: "Reports", icon: FileText, onClick: () => navigate("/reports") },
  ];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid flex-1 grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map(({ label, icon: Icon, onClick, shortcut }) => (
          <Hint key={label} label={shortcut ?? label}>
            <button
              onClick={onClick}
              className="group flex flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-2 py-4 text-center text-[13px] leading-tight font-medium text-[#344054] transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/60 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Icon className="size-7 text-brand-500 transition-colors group-hover:text-brand-600" strokeWidth={1.6} />
              {label}
            </button>
          </Hint>
        ))}
      </CardContent>
    </Card>
  );
}
