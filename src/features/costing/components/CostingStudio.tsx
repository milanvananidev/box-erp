import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles,
  RotateCcw,
  Save,
  Factory,
  Boxes,
  Layers,
  Percent,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/shared/FormField";
import { useParties } from "@/features/finance/api";
import {
  calculateBoxCost,
  createStandardLayers,
  PRESETS,
  type CorrugatedBoxInput,
  type PaperLayer,
  useSaveQuotation,
  usePaperRates,
} from "../api";
import { BoxVisualizer3D } from "./BoxVisualizer3D";
import { SheetCreasingDiagram } from "./SheetCreasingDiagram";

const INITIAL_BOX: CorrugatedBoxInput = {
  boxNo: "1",
  date: new Date().toISOString().split("T")[0],
  client: "",
  boxName: "5-Ply Master Shipper Carton",
  remark: "",
  unitMode: "mm",
  lengthMm: 300,
  widthMm: 200,
  heightMm: 200,
  ply: 5,
  addLMm: 50,
  addWMm: 20,
  ups: 1,
  wastePercent: 3.0,
  conversionRate: 10.0,
  convType: 1,
  printingRate: 0.0,
  transportPerBox: 0.0,
  laminationPerBox: 0.0,
  partitionCost: 0.0,
  setupCost: 0.0,
  orderQty: 1000,
  profitPercent: 10.0,
  taxPercent: 12.0,
  layers: createStandardLayers(5),
};

export function CostingStudio({
  initialBox,
  onQuotationCreated,
}: {
  initialBox?: CorrugatedBoxInput | null;
  onQuotationCreated?: () => void;
}) {
  const navigate = useNavigate();
  const partiesQuery = useParties();
  const paperRatesQuery = usePaperRates();
  const saveQuotationMutation = useSaveQuotation();

  const [input, setInput] = useState<CorrugatedBoxInput>(initialBox || INITIAL_BOX);
  const [unitMode, setUnitMode] = useState<"mm" | "inch">(initialBox?.unitMode === "inch" ? "inch" : "mm");
  const [visTab, setVisTab] = useState<"3d" | "2d">("3d");

  // In inch mode, display converted values
  const [dispL, setDispL] = useState<number>(initialBox ? initialBox.lengthMm : 300);
  const [dispW, setDispW] = useState<number>(initialBox ? initialBox.widthMm : 200);
  const [dispH, setDispH] = useState<number>(initialBox ? initialBox.heightMm : 200);

  useEffect(() => {
    if (initialBox) {
      setInput(initialBox);
      setUnitMode(initialBox.unitMode === "inch" ? "inch" : "mm");
      if (initialBox.unitMode === "inch") {
        setDispL(parseFloat((initialBox.lengthMm / 25.4).toFixed(2)));
        setDispW(parseFloat((initialBox.widthMm / 25.4).toFixed(2)));
        setDispH(parseFloat((initialBox.heightMm / 25.4).toFixed(2)));
      } else {
        setDispL(initialBox.lengthMm);
        setDispW(initialBox.widthMm);
        setDispH(initialBox.heightMm);
      }
    }
  }, [initialBox]);

  const customers = useMemo(() => {
    return (partiesQuery.data || []).filter((p) => p.type === "customer");
  }, [partiesQuery.data]);

  const handleUnitToggle = (mode: "mm" | "inch") => {
    if (mode === unitMode) return;
    setUnitMode(mode);
    if (mode === "inch") {
      setDispL(parseFloat((input.lengthMm / 25.4).toFixed(2)));
      setDispW(parseFloat((input.widthMm / 25.4).toFixed(2)));
      setDispH(parseFloat((input.heightMm / 25.4).toFixed(2)));
    } else {
      setDispL(Math.round(dispL * 25.4));
      setDispW(Math.round(dispW * 25.4));
      setDispH(Math.round(dispH * 25.4));
    }
  };

  const handleDimChange = (field: "L" | "W" | "H", val: number) => {
    if (field === "L") {
      setDispL(val);
      const mm = unitMode === "inch" ? Math.round(val * 25.4) : val;
      setInput((prev) => ({ ...prev, lengthMm: mm }));
    } else if (field === "W") {
      setDispW(val);
      const mm = unitMode === "inch" ? Math.round(val * 25.4) : val;
      setInput((prev) => ({ ...prev, widthMm: mm }));
    } else {
      setDispH(val);
      const mm = unitMode === "inch" ? Math.round(val * 25.4) : val;
      setInput((prev) => ({ ...prev, heightMm: mm }));
    }
  };

  const handlePlyChange = (plyCount: number) => {
    const newLayers = createStandardLayers(plyCount);
    setInput((prev) => ({
      ...prev,
      ply: plyCount,
      layers: newLayers,
    }));
  };

  const handleLoadPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    setInput({ ...preset.config });
    if (unitMode === "inch") {
      setDispL(parseFloat((preset.config.lengthMm / 25.4).toFixed(2)));
      setDispW(parseFloat((preset.config.widthMm / 25.4).toFixed(2)));
      setDispH(parseFloat((preset.config.heightMm / 25.4).toFixed(2)));
    } else {
      setDispL(preset.config.lengthMm);
      setDispW(preset.config.widthMm);
      setDispH(preset.config.heightMm);
    }
    toast.success(`Loaded preset: ${preset.name}`);
  };

  const updateLayer = (idx: number, patch: Partial<PaperLayer>) => {
    setInput((prev) => {
      const nextLayers = [...prev.layers];
      nextLayers[idx] = { ...nextLayers[idx], ...patch };
      return { ...prev, layers: nextLayers };
    });
  };

  const autoFillRatesFromMatrix = () => {
    const matrix = paperRatesQuery.data || [];
    if (!matrix.length) {
      toast.error("Paper rate matrix is empty. Configure it under the Paper Rates tab.");
      return;
    }

    let updatedCount = 0;
    const nextLayers = input.layers.map((l) => {
      const match = matrix.find(
        (r) => r.bf === l.bf && l.gsm >= r.minGsm && l.gsm <= r.maxGsm
      );
      if (match) {
        updatedCount++;
        return { ...l, rate: match.ratePerKg };
      }
      return l;
    });

    setInput((prev) => ({ ...prev, layers: nextLayers }));
    toast.success(`Updated ${updatedCount} layer rate(s) from rate matrix`);
  };

  // Perform live box costing calculation
  const result = useMemo(() => {
    return calculateBoxCost(input);
  }, [input]);

  const handleSaveQuotation = async () => {
    if (!input.boxName?.trim()) {
      toast.error("Please enter a box name");
      return;
    }
    if (input.lengthMm <= 0 || input.widthMm <= 0 || input.heightMm <= 0) {
      toast.error("Please enter valid box dimensions");
      return;
    }

    try {
      const clientObj = customers.find((c) => c.name === input.client);
      const quote = {
        id: "",
        quotationNumber: "",
        clientId: clientObj?.id,
        clientName: input.client || "Walk-in Customer",
        boxName: input.boxName,
        date: input.date || new Date().toISOString().split("T")[0],
        status: "DRAFT" as const,
        unitMode,
        input: { ...input },
        result: { ...result },
        quantity: input.orderQty || 1000,
        basicPrice: result.basicPrice,
        taxPercent: result.taxPercent,
        taxAmount: result.taxAmount,
        totalAmount: result.priceWithTax * (input.orderQty || 1000),
        notes: input.remark,
        createdAt: new Date().toISOString(),
      };

      await saveQuotationMutation.mutateAsync(quote);
      toast.success("Quotation saved successfully!");
      if (onQuotationCreated) onQuotationCreated();
    } catch (e) {
      toast.error("Failed to save quotation", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleConvertToProductionOrder = () => {
    // Navigate to production page with prefilled parameters
    const params = new URLSearchParams({
      new: "1",
      customer: input.client || "",
      product: `${input.boxName || "Carton"} (${input.ply}-Ply)`,
      qty: String(input.orderQty || 1000),
      l: String(input.lengthMm),
      w: String(input.widthMm),
      h: String(input.heightMm),
      ply: String(input.ply),
      flute: input.ply >= 5 ? "AB" : "B",
      rate: String(Math.round(result.basicPrice * 100)), // in paise
    });
    navigate(`/production?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Costing Studio & Preset Templates</h2>
            <p className="text-xs text-muted-foreground">Select a standard box template or design custom specifications.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(PRESETS).map(([key, p]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => handleLoadPreset(key)}
            >
              {p.name.split(" ")[0]}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInput(INITIAL_BOX);
              setDispL(300);
              setDispW(200);
              setDispH(200);
              setUnitMode("mm");
              toast.info("Reset to default 5-Ply box");
            }}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Main Grid: Inputs vs Results/Visualizers */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Costing Inputs Form (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card 1: Box Identity & Dimensions */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Boxes className="size-4 text-brand-600" /> Box Identity & Dimensions
                </CardTitle>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-subtle p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleUnitToggle("mm")}
                    className={`rounded px-2 py-0.5 font-medium transition cursor-pointer ${
                      unitMode === "mm" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                    }`}
                  >
                    mm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitToggle("inch")}
                    className={`rounded px-2 py-0.5 font-medium transition cursor-pointer ${
                      unitMode === "inch" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                    }`}
                  >
                    Inches
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Box Title / Product Name" htmlFor="box-name" required>
                  <Input
                    id="box-name"
                    value={input.boxName || ""}
                    onChange={(e) => setInput({ ...input, boxName: e.target.value })}
                    placeholder="e.g. 5-Ply Master Shipper Carton"
                  />
                </FormField>
                <FormField label="Customer / Client" htmlFor="box-client">
                  <Input
                    id="box-client"
                    list="costing-customers"
                    value={input.client || ""}
                    onChange={(e) => setInput({ ...input, client: e.target.value })}
                    placeholder="Select or enter customer name"
                  />
                  <datalist id="costing-customers">
                    {customers.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </FormField>
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-3 gap-3">
                <FormField label={`Length (${unitMode})`} htmlFor="dim-l" required>
                  <Input
                    id="dim-l"
                    type="number"
                    step="any"
                    value={dispL || ""}
                    onChange={(e) => handleDimChange("L", parseFloat(e.target.value) || 0)}
                  />
                </FormField>
                <FormField label={`Width (${unitMode})`} htmlFor="dim-w" required>
                  <Input
                    id="dim-w"
                    type="number"
                    step="any"
                    value={dispW || ""}
                    onChange={(e) => handleDimChange("W", parseFloat(e.target.value) || 0)}
                  />
                </FormField>
                <FormField label={`Height (${unitMode})`} htmlFor="dim-h" required>
                  <Input
                    id="dim-h"
                    type="number"
                    step="any"
                    value={dispH || ""}
                    onChange={(e) => handleDimChange("H", parseFloat(e.target.value) || 0)}
                  />
                </FormField>
              </div>

              {/* Allowances & Ups */}
              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border text-xs">
                <FormField label="Joint Lap (mm)" htmlFor="add-l" hint="Stitching / Pasting flap">
                  <Input
                    id="add-l"
                    type="number"
                    value={input.addLMm ?? 50}
                    onChange={(e) => setInput({ ...input, addLMm: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Flap Allow. (mm)" htmlFor="add-w" hint="Creasing fold tolerance">
                  <Input
                    id="add-w"
                    type="number"
                    value={input.addWMm ?? 20}
                    onChange={(e) => setInput({ ...input, addWMm: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Ups (Cutting)" htmlFor="ups" hint="Boxes cut per sheet">
                  <Input
                    id="ups"
                    type="number"
                    min="1"
                    value={input.ups ?? 1}
                    onChange={(e) => setInput({ ...input, ups: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Ply Construction & Paper Layers */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="size-4 text-brand-600" /> Ply Construction & Paper Layers
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(input.ply)}
                    onValueChange={(v) => handlePlyChange(parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-8 w-28 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3-Ply Board</SelectItem>
                      <SelectItem value="5">5-Ply Board</SelectItem>
                      <SelectItem value="7">7-Ply Board</SelectItem>
                      <SelectItem value="9">9-Ply Board</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="soft"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={autoFillRatesFromMatrix}
                    title="Auto-fill paper rates from the Rate Matrix based on BF & GSM"
                  >
                    Auto-Fill Rates
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-subtle text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-2 text-center">Type</th>
                      <th className="py-2 px-2 w-16">BF</th>
                      <th className="py-2 px-2 w-16">GSM</th>
                      <th className="py-2 px-2 w-16">Take-up</th>
                      <th className="py-2 px-2 w-20">Rate (₹/kg)</th>
                      <th className="py-2 px-3 text-right">Paper Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.layers.map((layer, idx) => (
                      <tr key={idx} className={layer.isFluting ? "bg-brand-50/30" : undefined}>
                        <td className="py-2.5 px-3 font-mono font-medium text-muted-foreground">
                          L{idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {layer.role}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              updateLayer(idx, {
                                isFluting: !layer.isFluting,
                                fluteFactor: !layer.isFluting ? 1.5 : 1.0,
                              })
                            }
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition cursor-pointer border ${
                              layer.isFluting
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-zinc-100 text-zinc-700 border-zinc-200"
                            }`}
                          >
                            {layer.isFluting ? "Nali (Flute)" : "Liner (Flat)"}
                          </button>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            className="h-7 text-xs px-1.5"
                            value={layer.bf}
                            onChange={(e) => updateLayer(idx, { bf: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            className="h-7 text-xs px-1.5"
                            value={layer.gsm}
                            onChange={(e) => updateLayer(idx, { gsm: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            step="0.05"
                            disabled={!layer.isFluting}
                            className="h-7 text-xs px-1.5 disabled:opacity-40"
                            value={layer.fluteFactor}
                            onChange={(e) => updateLayer(idx, { fluteFactor: parseFloat(e.target.value) || 1 })}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            step="0.5"
                            className="h-7 text-xs px-1.5"
                            value={layer.rate}
                            onChange={(e) => updateLayer(idx, { rate: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          ₹{layer.costRs?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-subtle font-semibold border-t border-border">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 text-muted-foreground">Totals</td>
                      <td className="py-2 px-2 font-mono text-brand-700">{result.totalBs} BS</td>
                      <td className="py-2 px-2 font-mono">{result.totalGsm} GSM</td>
                      <td className="py-2 px-2 font-mono">{(result.totalWeightKg * 1000).toFixed(0)} g/box</td>
                      <td colSpan={2} className="py-2 px-3 text-right font-mono text-brand-700 text-sm">
                        ₹{result.totalPaperCost.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Overheads, Conversion, Margin & Tax */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Percent className="size-4 text-brand-600" /> Overheads, Conversion, Margin & Tax
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <FormField label="Wastage (%)" htmlFor="oh-waste">
                  <Input
                    id="oh-waste"
                    type="number"
                    step="0.1"
                    value={input.wastePercent ?? 3}
                    onChange={(e) => setInput({ ...input, wastePercent: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Conversion Rate" htmlFor="oh-conv" hint={input.convType === 1 ? "₹ / kg" : "₹ / box"}>
                  <Input
                    id="oh-conv"
                    type="number"
                    step="0.5"
                    value={input.conversionRate ?? 10}
                    onChange={(e) => setInput({ ...input, conversionRate: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Printing (₹/box)" htmlFor="oh-print">
                  <Input
                    id="oh-print"
                    type="number"
                    step="0.1"
                    value={input.printingRate ?? 0}
                    onChange={(e) => setInput({ ...input, printingRate: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Transport (₹/box)" htmlFor="oh-trans">
                  <Input
                    id="oh-trans"
                    type="number"
                    step="0.1"
                    value={input.transportPerBox ?? 0}
                    onChange={(e) => setInput({ ...input, transportPerBox: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-border">
                <FormField label="Order Qty (pcs)" htmlFor="oh-qty">
                  <Input
                    id="oh-qty"
                    type="number"
                    value={input.orderQty ?? 1000}
                    onChange={(e) => setInput({ ...input, orderQty: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </FormField>
                <FormField label="Setup Cost (₹)" htmlFor="oh-setup" hint="Amortized over order">
                  <Input
                    id="oh-setup"
                    type="number"
                    value={input.setupCost ?? 0}
                    onChange={(e) => setInput({ ...input, setupCost: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Profit Margin (%)" htmlFor="oh-profit">
                  <Input
                    id="oh-profit"
                    type="number"
                    step="0.5"
                    value={input.profitPercent ?? 10}
                    onChange={(e) => setInput({ ...input, profitPercent: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="GST / Tax (%)" htmlFor="oh-tax">
                  <Input
                    id="oh-tax"
                    type="number"
                    value={input.taxPercent ?? 12}
                    onChange={(e) => setInput({ ...input, taxPercent: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Visualizer, Cost Summary & Actions (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Card: 3D Simulation & Creasing Blueprint */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border pb-3 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Visualizer & Blueprint</CardTitle>
                <CardDescription className="text-xs">
                  Blank: {result.sheetLengthInch}&quot; × {result.sheetWidthInch}&quot; ({result.inMmL} × {result.inMmW} mm)
                </CardDescription>
              </div>
              <Tabs value={visTab} onValueChange={(v) => setVisTab(v as "3d" | "2d")}>
                <TabsList className="h-8">
                  <TabsTrigger value="3d" className="text-xs px-2.5 py-1">3D Box</TabsTrigger>
                  <TabsTrigger value="2d" className="text-xs px-2.5 py-1">2D Creasing</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-3">
              {visTab === "3d" ? (
                <BoxVisualizer3D
                  length={input.lengthMm}
                  width={input.widthMm}
                  height={input.heightMm}
                  unit={unitMode}
                  ply={input.ply}
                />
              ) : (
                <SheetCreasingDiagram
                  length={input.lengthMm}
                  width={input.widthMm}
                  height={input.heightMm}
                  addL={input.addLMm ?? 50}
                  addW={input.addWMm ?? 20}
                  unit={unitMode}
                  ply={input.ply}
                  sheetLengthInch={result.sheetLengthInch}
                  sheetWidthInch={result.sheetWidthInch}
                  isEmbedded={true}
                />
              )}
            </CardContent>
          </Card>

          {/* Card: Live Cost Breakdown & Pricing */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold">Cost Breakdown & Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                  <div className="text-xs text-muted-foreground font-medium">Basic Box Rate</div>
                  <div className="mt-1 text-2xl font-bold text-brand-700 tabular">
                    ₹{result.basicPrice.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Ex-factory rate per box</div>
                </div>

                <div className="rounded-xl border border-border bg-subtle p-3">
                  <div className="text-xs text-muted-foreground font-medium">Price With GST ({result.taxPercent}%)</div>
                  <div className="mt-1 text-2xl font-bold text-foreground tabular">
                    ₹{result.priceWithTax.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Total per box incl. tax</div>
                </div>
              </div>

              {/* Breakdown List */}
              <div className="divide-y divide-border rounded-xl border border-border bg-card text-xs">
                <div className="flex justify-between py-2 px-3">
                  <span className="text-muted-foreground">Raw Paper Cost</span>
                  <span className="font-mono font-medium">₹{result.totalPaperCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 px-3">
                  <span className="text-muted-foreground">Wastage ({input.wastePercent}%)</span>
                  <span className="font-mono font-medium">₹{result.wastageCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 px-3">
                  <span className="text-muted-foreground">Conversion</span>
                  <span className="font-mono font-medium">₹{result.conversionCost.toFixed(2)}</span>
                </div>
                {result.printingCost > 0 && (
                  <div className="flex justify-between py-2 px-3">
                    <span className="text-muted-foreground">Printing</span>
                    <span className="font-mono font-medium">₹{result.printingCost.toFixed(2)}</span>
                  </div>
                )}
                {result.transportCost > 0 && (
                  <div className="flex justify-between py-2 px-3">
                    <span className="text-muted-foreground">Freight / Transport</span>
                    <span className="font-mono font-medium">₹{result.transportCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 px-3 bg-subtle font-medium">
                  <span>Manufacturing Cost</span>
                  <span className="font-mono font-bold">₹{result.manufacturingCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 px-3 text-success-foreground">
                  <span>Profit Margin ({input.profitPercent}%)</span>
                  <span className="font-mono font-semibold">+₹{result.profitAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 px-3 bg-subtle font-bold text-foreground">
                  <span>Total Order Value ({input.orderQty || 1000} pcs)</span>
                  <span className="font-mono text-sm text-brand-700">
                    ₹{((result.priceWithTax * (input.orderQty || 1000))).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleSaveQuotation}
                  loading={saveQuotationMutation.isPending}
                  className="w-full"
                >
                  <Save className="size-4" /> Save as Quotation
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConvertToProductionOrder}
                  className="w-full border-brand-300 text-brand-700 hover:bg-brand-50"
                >
                  <Factory className="size-4" /> Create Production Order
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
