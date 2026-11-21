import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, RotateCcw, Search, TrendingUp, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { StatCard } from "@/components/shared/StatCard";
import { formatRupees } from "@/lib/format";
import {
  usePaperRates,
  useSavePaperRates,
  DEFAULT_PAPER_RATES,
  type IPaperRateItem,
} from "../api";

export function PaperRatesView() {
  const { data: serverRates } = usePaperRates();
  const saveMutation = useSavePaperRates();

  const [rates, setRates] = useState<IPaperRateItem[]>([]);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (serverRates) {
      setRates(serverRates);
      setDirty(false);
    }
  }, [serverRates]);

  const stats = {
    count: rates.length,
    avg: rates.length ? (rates.reduce((s, r) => s + r.ratePerKg, 0) / rates.length).toFixed(1) : "0",
    min: rates.length ? Math.min(...rates.map((r) => r.ratePerKg)).toFixed(1) : "0",
    max: rates.length ? Math.max(...rates.map((r) => r.ratePerKg)).toFixed(1) : "0",
  };

  const filtered = rates.filter(
    (r) =>
      r.paperType.toLowerCase().includes(search.toLowerCase()) ||
      r.bf.toString().includes(search) ||
      r.ratePerKg.toString().includes(search)
  );

  const handleAdd = () => {
    const newItem: IPaperRateItem = {
      id: `r_${Date.now()}`,
      bf: 16,
      minGsm: 120,
      maxGsm: 180,
      ratePerKg: 36,
      paperType: "Kraft Paper",
    };
    setRates([newItem, ...rates]);
    setDirty(true);
  };

  const handleUpdate = (id: string, patch: Partial<IPaperRateItem>) => {
    setRates(rates.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const handleDelete = (id: string) => {
    setRates(rates.filter((r) => r.id !== id));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(rates);
      setDirty(false);
      toast.success("Paper rate matrix saved successfully!");
    } catch (e) {
      toast.error("Failed to save rates", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleResetDefaults = () => {
    setRates([...DEFAULT_PAPER_RATES]);
    setDirty(true);
    toast.info("Reset to default standard rates (remember to save)");
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Grades" value={String(stats.count)} icon={Layers} tone="brand" />
        <StatCard label="Average Rate" value={formatRupees(Number(stats.avg), { decimals: 2 })} icon={TrendingUp} tone="info" />
        <StatCard label="Lowest Rate" value={formatRupees(Number(stats.min), { decimals: 2 })} icon={TrendingUp} tone="success" />
        <StatCard label="Highest Rate" value={formatRupees(Number(stats.max), { decimals: 2 })} icon={TrendingUp} tone="brand" />
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Paper Rate Matrix</CardTitle>
              <CardDescription>
                Standard rates per kg mapped by Bursting Factor (BF) and GSM range. Used to auto-fill costing layers.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleResetDefaults}>
                <RotateCcw className="size-3.5" /> Defaults
              </Button>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="size-3.5" /> Add Grade
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saveMutation.isPending}
                disabled={!dirty}
              >
                <Save className="size-3.5" /> Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="p-4 border-b border-border bg-subtle">
          <div className="relative max-w-sm">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search paper grade, BF, or rate..."
              className="pl-9 bg-card"
            />
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-subtle text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-4">Paper Type / Grade</th>
                  <th className="py-2.5 px-4 w-28">BF (Strength)</th>
                  <th className="py-2.5 px-4 w-32">Min GSM</th>
                  <th className="py-2.5 px-4 w-32">Max GSM</th>
                  <th className="py-2.5 px-4 w-36">Rate (₹ / kg)</th>
                  <th className="py-2.5 px-4 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-subtle/40 transition">
                    <td className="py-2 px-4">
                      <Input
                        value={item.paperType}
                        onChange={(e) => handleUpdate(item.id, { paperType: e.target.value })}
                        className="h-8 text-xs font-medium"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <Input
                        type="number"
                        value={item.bf}
                        onChange={(e) => handleUpdate(item.id, { bf: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs font-mono"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <Input
                        type="number"
                        value={item.minGsm}
                        onChange={(e) => handleUpdate(item.id, { minGsm: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs font-mono"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <Input
                        type="number"
                        value={item.maxGsm}
                        onChange={(e) => handleUpdate(item.id, { maxGsm: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs font-mono"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <CurrencyInput
                        value={item.ratePerKg}
                        onChange={(val) => handleUpdate(item.id, { ratePerKg: val ?? 0 })}
                        className="h-8 text-xs font-mono font-bold text-brand-700"
                      />
                    </td>
                    <td className="py-2 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-danger hover:text-danger hover:bg-danger-soft"
                        onClick={() => handleDelete(item.id)}
                        title="Delete Grade"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
