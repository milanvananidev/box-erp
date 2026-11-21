import { useNavigate } from "react-router-dom";
import { Boxes, Plus, ArrowDownToLine, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useMaterials, useMovements } from "@/features/inventory/api";
import { cn } from "@/lib/utils";

export function InventoryOverviewCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { data: materials = [] } = useMaterials();
  const { data: movements = [] } = useMovements();

  const registeredCount = materials.length;
  const reorderAlerts = materials.filter((m) => m.stock <= m.reorderLevel).length;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthMovements = movements.filter((m) => m.date.startsWith(currentMonth));
  const materialReceived = thisMonthMovements
    .filter((m) => m.type === "inward")
    .reduce((sum, m) => sum + (m.value || 0), 0);

  return (
    <div className={cn("flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-2xs select-none", className)}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Boxes className="size-3.5 text-[#C98F4F]" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-foreground tracking-tight">Inventory Overview</h3>
              <p className="text-[11px] text-muted-foreground">Raw paper reels & stock levels</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/inventory")}
            className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
          >
            Stocks <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Metrics List */}
        <div className="divide-y divide-border/60 py-1.5">
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground text-[11px]">Materials registered</span>
            <span className="font-semibold text-foreground text-xs font-mono">{registeredCount}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground text-[11px]">Reorder alerts</span>
            <span className={cn(
              "font-semibold text-xs font-mono",
              reorderAlerts > 0 ? "text-danger-foreground font-bold" : "text-foreground",
            )}>
              {reorderAlerts}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground text-[11px]">Material inward (this month)</span>
            <span className="font-semibold text-foreground text-xs font-mono">{formatINR(materialReceived)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-border/60">
        <button
          onClick={() => navigate("/inventory?action=add")}
          className="flex h-7 items-center justify-center gap-1.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="size-3" /> Add Material
        </button>
        <button
          onClick={() => navigate("/inventory?action=inward")}
          className="flex h-7 items-center justify-center gap-1.5 rounded border border-border bg-subtle hover:bg-muted text-[11px] font-semibold text-foreground/80 transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowDownToLine className="size-3 text-muted-foreground" /> Inward Entry
        </button>
      </div>
    </div>
  );
}
