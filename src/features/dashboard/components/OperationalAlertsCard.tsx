import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { useMaterials } from "@/features/inventory/api";
import { usePendingSalaries } from "../api";

export function OperationalAlertsCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { data: materials = [] } = useMaterials();
  const { data: pending = [] } = usePendingSalaries();

  const totalPendingAmount = pending.reduce((sum, p) => sum + (p.netPayable || 0), 0);
  const pendingCount = pending.filter((p) => (p.netPayable || 0) > 0).length;

  // Alerts logic
  const alerts = [
    {
      id: "mat",
      icon: Boxes,
      title: materials.length === 0 ? "No materials added" : `${materials.filter((m) => m.stock <= m.reorderLevel).length} Low stock alerts`,
      description: materials.length === 0 ? "Add raw materials to start tracking stock." : "Raw material inventory requires replenishment.",
      btnText: "Add Material",
      onClick: () => navigate("/inventory"),
    },
    {
      id: "sal",
      icon: Calendar,
      title: "Salary pending",
      description: `${formatINR(totalPendingAmount)} due for ${pendingCount} worker${pendingCount !== 1 ? "s" : ""}.`,
      btnText: "Review Payroll",
      onClick: () => navigate("/payroll"),
    },
    {
      id: "reorder",
      icon: Tag,
      title: "Reorder not set",
      description: "Set reorder levels for key paper reels & gum.",
      btnText: "Set Reorder",
      onClick: () => navigate("/inventory"),
    },
  ];

  return (
    <div className={`flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs ${className || ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[#C98F4F]" />
          <h3 className="text-base font-bold text-foreground">Operational Alerts</h3>
        </div>
        <span className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
          {alerts.length}
        </span>
      </div>

      {/* Alerts list */}
      <div className="divide-y divide-border/60 my-auto">
        {alerts.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-subtle text-[#C98F4F]">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.description}</div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={a.onClick}
                className="shrink-0 text-xs h-7.5 px-3 border-border hover:bg-subtle text-[#344054] font-medium"
              >
                {a.btnText}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
