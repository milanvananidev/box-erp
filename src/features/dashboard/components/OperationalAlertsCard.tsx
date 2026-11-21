import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, Calendar, Tag, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useMaterials } from "@/features/inventory/api";
import { usePendingSalaries } from "../api";
import { cn } from "@/lib/utils";

export function OperationalAlertsCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { data: materials = [] } = useMaterials();
  const { data: pending = [] } = usePendingSalaries();

  const totalPendingAmount = pending.reduce((sum, p) => sum + (p.netPayable || 0), 0);
  const pendingCount = pending.filter((p) => (p.netPayable || 0) > 0).length;

  const alerts = [
    {
      id: "mat",
      icon: Boxes,
      title: materials.length === 0 ? "No materials added" : `${materials.filter((m) => m.stock <= m.reorderLevel).length} Low stock alerts`,
      description: materials.length === 0 ? "Add raw materials to start tracking stock." : "Raw material inventory requires replenishment.",
      btnText: "Stock Entry",
      onClick: () => navigate("/inventory"),
    },
    {
      id: "sal",
      icon: Calendar,
      title: "Salary pending",
      description: `${formatINR(totalPendingAmount)} due for ${pendingCount} worker${pendingCount !== 1 ? "s" : ""}.`,
      btnText: "Review",
      onClick: () => navigate("/payroll"),
    },
    {
      id: "reorder",
      icon: Tag,
      title: "Reorder levels",
      description: "Set reorder thresholds for paper reels.",
      btnText: "Configure",
      onClick: () => navigate("/inventory"),
    },
  ];

  return (
    <div className={cn("flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-2xs select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <AlertTriangle className="size-3.5 text-[#C98F4F]" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-foreground tracking-tight">Operational Alerts</h3>
            <p className="text-[11px] text-muted-foreground">Action items requiring review</p>
          </div>
        </div>
        <span className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-900">
          {alerts.length}
        </span>
      </div>

      {/* Alerts list */}
      <div className="divide-y divide-border/60 my-auto">
        {alerts.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-md bg-subtle text-foreground/70">
                  <Icon className="size-3.5 text-[#C98F4F]" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground leading-tight truncate">{a.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{a.description}</p>
                </div>
              </div>
              <button
                onClick={a.onClick}
                className="shrink-0 flex items-center gap-1 h-6 px-2 rounded border border-border bg-subtle hover:bg-muted text-[10px] font-semibold text-foreground/80 transition-colors cursor-pointer"
              >
                {a.btnText} <ArrowRight className="size-2.5 text-muted-foreground" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Factory Health: Normal</span>
        <span className="text-emerald-600 font-semibold flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500" /> All Services Online
        </span>
      </div>
    </div>
  );
}
