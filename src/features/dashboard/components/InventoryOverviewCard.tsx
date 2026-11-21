import { useNavigate } from "react-router-dom";
import { Boxes, Plus, ArrowDownToLine, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { useMaterials, useMovements } from "@/features/inventory/api";

export function InventoryOverviewCard() {
  const navigate = useNavigate();
  const { data: materials = [] } = useMaterials();
  const { data: movements = [] } = useMovements();

  const registeredCount = materials.length;
  const reorderAlerts = materials.filter((m) => m.stock <= m.reorderLevel).length;

  // Monthly received & used
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthMovements = movements.filter((m) => m.date.startsWith(currentMonth));
  const materialReceived = thisMonthMovements
    .filter((m) => m.type === "inward")
    .reduce((sum, m) => sum + (m.value || 0), 0);
  const materialUsed = thisMonthMovements
    .filter((m) => m.type === "issue")
    .reduce((sum, m) => sum + (m.value || 0), 0);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Boxes className="size-4 text-[#C98F4F]" />
            </span>
            <h3 className="text-base font-bold text-foreground">Inventory Overview</h3>
          </div>
          <button
            onClick={() => navigate("/inventory")}
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
          >
            View All <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Metrics List */}
        <div className="divide-y divide-border/60 py-2">
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground">Materials registered</span>
            <span className="font-semibold text-foreground text-sm font-mono">{registeredCount}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground">Reorder alerts</span>
            <span className={`font-semibold text-sm font-mono ${reorderAlerts > 0 ? "text-danger-foreground font-bold" : "text-foreground"}`}>
              {reorderAlerts}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground">Material received (this month)</span>
            <span className="font-semibold text-foreground text-sm font-mono">{formatINR(materialReceived)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground">Material used (this month)</span>
            <span className="font-semibold text-foreground text-sm font-mono">{formatINR(materialUsed)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-border/60">
        <Button
          size="sm"
          onClick={() => navigate("/inventory")}
          className="text-xs h-8 bg-[#C98F4F] hover:bg-[#B37A3B] text-white font-medium shadow-xs"
        >
          <Plus className="size-3.5" /> Add Material
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/inventory?inward=1")}
          className="text-xs h-8 text-[#344054] font-medium border-border hover:bg-subtle"
        >
          <ArrowDownToLine className="size-3.5 text-brand-600" /> Material Inward
        </Button>
      </div>
    </div>
  );
}
