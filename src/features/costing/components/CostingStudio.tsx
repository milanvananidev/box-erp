import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  RotateCcw,
  Save,
  Boxes,
  Layers,
  Percent,
  Copy,
  Sliders,
  Zap,
  ChevronDown,
  ChevronUp,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { useParties } from "@/features/finance/api";
import { useCompany } from "@/lib/company";
import { formatRupees } from "@/lib/format";
import {
  calculateBoxCost,
  createStandardLayers,
  PRESETS,
  type CorrugatedBoxInput,
  type PaperLayer,
  useSaveQuotation,
  usePaperRates,
} from "../api";
import { SheetCreasingDiagram } from "./SheetCreasingDiagram";
import { BoxVisualizer3D } from "./BoxVisualizer3D";

interface PaperGradeOption {
  id: string;
  name: string;
  sub: string;
  fluteGsm: number;
  fluteBf: number;
  linerGsm: number;
  linerBf: number;
  fluteRate: number;
  linerRate: number;
}

const PAPER_GRADES: PaperGradeOption[] = [
  {
    id: "standard",
    name: "Standard Commercial",
    sub: "120 GSM Fluting / 150 GSM Liner · 16 BF",
    fluteGsm: 120,
    fluteBf: 14,
    linerGsm: 150,
    linerBf: 16,
    fluteRate: 34,
    linerRate: 38,
  },
  {
    id: "heavy",
    name: "Heavy Duty Shipper",
    sub: "140 GSM Fluting / 180 GSM Liner · 20 BF",
    fluteGsm: 140,
    fluteBf: 16,
    linerGsm: 180,
    linerBf: 20,
    fluteRate: 36,
    linerRate: 44,
  },
  {
    id: "export",
    name: "Virgin Kraft Export",
    sub: "160 GSM Fluting / 230 GSM Liner · 28 BF",
    fluteGsm: 160,
    fluteBf: 18,
    linerGsm: 230,
    linerBf: 28,
    fluteRate: 40,
    linerRate: 52,
  },
];

const INITIAL_BOX: CorrugatedBoxInput = {
  boxNo: "1",
  date: new Date().toISOString().split("T")[0],
  boxName: "5-Ply Master Shipper Carton",
  remark: "Standard Corrugated Box",
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
  const partiesQuery = useParties();
  const paperRatesQuery = usePaperRates();
  const saveQuotationMutation = useSaveQuotation();
  const company = useCompany();

  const [input, setInput] = useState<CorrugatedBoxInput>(initialBox || INITIAL_BOX);
  const [unitMode, setUnitMode] = useState<"mm" | "inch">(initialBox?.unitMode === "inch" ? "inch" : "mm");
  const [studioMode, setStudioMode] = useState<"quick" | "advanced">("quick");
  const [visTab, setVisTab] = useState<"3d" | "2d">("3d");
  const [selectedGrade, setSelectedGrade] = useState<string>("standard");
  const [showCostBreakdown, setShowCostBreakdown] = useState<boolean>(false);

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

  const applyGradeToLayers = (gradeId: string, plyCount: number) => {
    const grade = PAPER_GRADES.find((g) => g.id === gradeId) || PAPER_GRADES[0];
    const newLayers: PaperLayer[] = [];
    for (let i = 1; i <= plyCount; i++) {
      const isFluting = i % 2 === 0;
      let role = "";
      if (i === 1) role = "Top Liner (Face)";
      else if (i === plyCount) role = "Bottom Liner";
      else if (isFluting) role = `Fluting ${Math.ceil(i / 2)} (Nali)`;
      else role = `Center Liner ${Math.floor(i / 2)}`;

      newLayers.push({
        layerNum: i,
        role,
        isFluting,
        bf: isFluting ? grade.fluteBf : grade.linerBf,
        gsm: isFluting ? grade.fluteGsm : grade.linerGsm,
        fluteFactor: isFluting ? 1.5 : 1.0,
        rate: isFluting ? grade.fluteRate : grade.linerRate,
      });
    }
    return newLayers;
  };

  const handlePlyChange = (plyCount: number) => {
    const newLayers = applyGradeToLayers(selectedGrade, plyCount);
    setInput((prev) => ({
      ...prev,
      ply: plyCount,
      boxName: `${plyCount}-Ply ${(prev.boxName || "").replace(/^[3579]-Ply\s*/i, "") || "Carton"}`,
      layers: newLayers,
    }));
  };

  const handleGradeChange = (gradeId: string) => {
    setSelectedGrade(gradeId);
    const newLayers = applyGradeToLayers(gradeId, input.ply);
    setInput((prev) => ({
      ...prev,
      layers: newLayers,
    }));
    toast.success(`Applied ${PAPER_GRADES.find((g) => g.id === gradeId)?.name}`);
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
    toast.success(`Loaded: ${preset.name}`);
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

  const handleCopyWhatsApp = () => {
    const summaryText = `📦 *QUOTATION - ${input.boxName}*
*${company.name}*

Client: ${input.client || "Valued Customer"}
Size: ${input.lengthMm} × ${input.widthMm} × ${input.heightMm} mm (${input.ply}-Ply)
Order Qty: ${(input.orderQty || 1000).toLocaleString("en-IN")} pcs
Rate per Box: ${formatRupees(result.basicPrice)}
GST (${result.taxPercent}%): ${formatRupees(result.taxAmount)}
Final Rate: ${formatRupees(result.priceWithTax)} / box
*Total Order: ${formatRupees(result.priceWithTax * (input.orderQty || 1000))}*

Estimated Board BS: ${result.totalBs.toFixed(1)} kg/cm²
Weight per Box: ${(result.totalWeightKg * 1000).toFixed(0)} grams

For any queries, please call: ${company.phone}`;

    navigator.clipboard.writeText(summaryText);
    toast.success("Quotation copied to clipboard for WhatsApp!");
  };

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

  return (
    <div className="space-y-6">
      {/* Top Bar: Mode Selector & Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-3.5 shadow-card">
        {/* Simple vs Advanced Mode */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-subtle p-1">
          <button
            type="button"
            onClick={() => setStudioMode("quick")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              studioMode === "quick"
                ? "bg-card text-brand-700 shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="size-3.5" /> Quick Estimate
          </button>
          <button
            type="button"
            onClick={() => setStudioMode("advanced")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              studioMode === "advanced"
                ? "bg-card text-brand-700 shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="size-3.5" /> Engineering Studio
          </button>
        </div>

        {/* Quick Box Templates */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Templates:</span>
          {Object.entries(PRESETS).map(([key, p]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => handleLoadPreset(key)}
              className="text-xs h-7"
            >
              {p.name.includes("5-Ply") ? "5-Ply Master" : p.name.includes("3-Ply") ? "3-Ply E-Com" : "7-Ply Industrial"}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setInput(INITIAL_BOX);
              setDispL(300);
              setDispW(200);
              setDispH(200);
              setUnitMode("mm");
              setSelectedGrade("standard");
              toast.info("Reset to default 5-Ply carton");
            }}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Costing Inputs (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {studioMode === "quick" ? (
            /* ───────────────────────────────────────────────────────────
               SIMPLE / QUICK QUOTE MODE
               ─────────────────────────────────────────────────────────── */
            <>
              {/* Card 1: Box Dimensions & Ply */}
              <Card>
                <CardHeader className="border-b border-border pb-3.5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Boxes className="size-4 text-brand-600" /> 1. Box Size & Structure
                    </CardTitle>
                    {/* Unit Toggle */}
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-subtle p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handleUnitToggle("mm")}
                        className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
                          unitMode === "mm" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                        }`}
                      >
                        mm
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitToggle("inch")}
                        className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
                          unitMode === "inch" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                        }`}
                      >
                        Inches
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Ply Structure Selector */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      Board Ply Selection
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { ply: 3, label: "3-Ply", sub: "Single Wall (Light)" },
                        { ply: 5, label: "5-Ply", sub: "Double Wall (Standard)" },
                        { ply: 7, label: "7-Ply", sub: "Triple Wall (Heavy)" },
                      ].map((item) => (
                        <button
                          key={item.ply}
                          type="button"
                          onClick={() => handlePlyChange(item.ply)}
                          className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition cursor-pointer ${
                            input.ply === item.ply
                              ? "border-brand-500 bg-brand-50/70 text-brand-800 shadow-xs ring-1 ring-brand-400"
                              : "border-border bg-card hover:bg-subtle text-foreground"
                          }`}
                        >
                          <span className="text-sm font-bold">{item.label}</span>
                          <span className="text-[11px] text-muted-foreground">{item.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dimensions Inputs */}
                  <div className="grid grid-cols-3 gap-3">
                    <FormField label={`Length (${unitMode})`} htmlFor="dim-l" required>
                      <Input
                        id="dim-l"
                        type="number"
                        step={unitMode === "inch" ? "0.1" : "1"}
                        value={dispL}
                        onChange={(e) => handleDimChange("L", parseFloat(e.target.value) || 0)}
                        className="text-base font-semibold"
                      />
                    </FormField>
                    <FormField label={`Width (${unitMode})`} htmlFor="dim-w" required>
                      <Input
                        id="dim-w"
                        type="number"
                        step={unitMode === "inch" ? "0.1" : "1"}
                        value={dispW}
                        onChange={(e) => handleDimChange("W", parseFloat(e.target.value) || 0)}
                        className="text-base font-semibold"
                      />
                    </FormField>
                    <FormField label={`Height (${unitMode})`} htmlFor="dim-h" required>
                      <Input
                        id="dim-h"
                        type="number"
                        step={unitMode === "inch" ? "0.1" : "1"}
                        value={dispH}
                        onChange={(e) => handleDimChange("H", parseFloat(e.target.value) || 0)}
                        className="text-base font-semibold"
                      />
                    </FormField>
                  </div>

                  {/* Box Name & Client */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <FormField label="Box Title" htmlFor="box-name" required>
                      <Input
                        id="box-name"
                        value={input.boxName || ""}
                        onChange={(e) => setInput({ ...input, boxName: e.target.value })}
                        placeholder="e.g. 5-Ply Shipper Carton"
                      />
                    </FormField>
                    <FormField label="Customer / Party" htmlFor="box-client">
                      <Input
                        id="box-client"
                        list="costing-customers"
                        value={input.client || ""}
                        onChange={(e) => setInput({ ...input, client: e.target.value })}
                        placeholder="Select or enter customer"
                      />
                      <datalist id="costing-customers">
                        {customers.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Paper Quality & Finish */}
              <Card>
                <CardHeader className="border-b border-border pb-3.5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="size-4 text-brand-600" /> 2. Paper Quality & Printing
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Paper Grade Selector */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      Paper Quality Grade
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {PAPER_GRADES.map((grade) => (
                        <button
                          key={grade.id}
                          type="button"
                          onClick={() => handleGradeChange(grade.id)}
                          className={`flex flex-col items-start rounded-xl border p-3 text-left transition cursor-pointer ${
                            selectedGrade === grade.id
                              ? "border-brand-500 bg-brand-50/70 text-brand-900 shadow-xs ring-1 ring-brand-400"
                              : "border-border bg-card hover:bg-subtle text-foreground"
                          }`}
                        >
                          <span className="text-xs font-bold">{grade.name}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{grade.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Printing Color Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <FormField label="Flexo Printing" htmlFor="print-type">
                      <Select
                        value={input.printingRate === 0 ? "none" : input.printingRate === 0.5 ? "1color" : input.printingRate === 1.0 ? "2color" : "multi"}
                        onValueChange={(val) => {
                          const rates: Record<string, number> = { none: 0.0, "1color": 0.5, "2color": 1.0, multi: 2.0 };
                          setInput({ ...input, printingRate: rates[val] ?? 0 });
                        }}
                      >
                        <SelectTrigger id="print-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Plain (No Print) — ₹0.00</SelectItem>
                          <SelectItem value="1color">1-Color Flexo (+₹0.50/box)</SelectItem>
                          <SelectItem value="2color">2-Color Flexo (+₹1.00/box)</SelectItem>
                          <SelectItem value="multi">Multicolor Flexo (+₹2.00/box)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField label="Transport / Freight (₹/box)" htmlFor="transport">
                      <Input
                        id="transport"
                        type="number"
                        step="0.1"
                        min="0"
                        value={input.transportPerBox || 0}
                        onChange={(e) => setInput({ ...input, transportPerBox: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Order Quantity & Margin */}
              <Card>
                <CardHeader className="border-b border-border pb-3.5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Percent className="size-4 text-brand-600" /> 3. Quantity & Profit Margin
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Order Quantity (Boxes)" htmlFor="order-qty" required>
                      <Input
                        id="order-qty"
                        type="number"
                        step="100"
                        min="1"
                        value={input.orderQty || 1000}
                        onChange={(e) => setInput({ ...input, orderQty: parseInt(e.target.value) || 0 })}
                        className="text-base font-semibold"
                      />
                    </FormField>

                    <FormField label="Profit Margin (%)" htmlFor="profit-pct" required>
                      <Input
                        id="profit-pct"
                        type="number"
                        step="0.5"
                        min="0"
                        value={input.profitPercent}
                        onChange={(e) => setInput({ ...input, profitPercent: parseFloat(e.target.value) || 0 })}
                        className="text-base font-semibold"
                      />
                    </FormField>
                  </div>

                  {/* Quick Margin Pills */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground font-medium">Quick Margin:</span>
                    {[8, 10, 12, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setInput({ ...input, profitPercent: pct })}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          input.profitPercent === pct
                            ? "bg-brand-600 text-white font-bold"
                            : "bg-subtle text-foreground hover:bg-muted"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Switch to Detailed Link */}
                  <div className="border-t border-border/80 pt-3 flex justify-between items-center text-xs text-muted-foreground">
                    <span>Need layer-by-layer GSM/BF or custom machine allowances?</span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setStudioMode("advanced")}
                      className="p-0 h-auto text-brand-600 font-semibold cursor-pointer"
                    >
                      Open Engineering Studio →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            /* ───────────────────────────────────────────────────────────
               ADVANCED / ENGINEERING STUDIO MODE
               ─────────────────────────────────────────────────────────── */
            <>
              {/* Detailed Specs Card */}
              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Boxes className="size-4 text-brand-600" /> Machine Specifications & Sizing
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStudioMode("quick")}
                      className="text-xs text-brand-600"
                    >
                      ← Back to Quick Estimate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField label={`Length (${unitMode})`} required>
                      <Input
                        type="number"
                        value={dispL}
                        onChange={(e) => handleDimChange("L", parseFloat(e.target.value) || 0)}
                      />
                    </FormField>
                    <FormField label={`Width (${unitMode})`} required>
                      <Input
                        type="number"
                        value={dispW}
                        onChange={(e) => handleDimChange("W", parseFloat(e.target.value) || 0)}
                      />
                    </FormField>
                    <FormField label={`Height (${unitMode})`} required>
                      <Input
                        type="number"
                        value={dispH}
                        onChange={(e) => handleDimChange("H", parseFloat(e.target.value) || 0)}
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <FormField label="Ply Count">
                      <Select
                        value={String(input.ply)}
                        onValueChange={(val) => handlePlyChange(parseInt(val))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3-Ply (Single Wall)</SelectItem>
                          <SelectItem value="5">5-Ply (Double Wall)</SelectItem>
                          <SelectItem value="7">7-Ply (Triple Wall)</SelectItem>
                          <SelectItem value="9">9-Ply (Heavy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Lap Allowance (mm)">
                      <Input
                        type="number"
                        value={input.addLMm}
                        onChange={(e) => setInput({ ...input, addLMm: parseFloat(e.target.value) || 0 })}
                      />
                    </FormField>
                    <FormField label="Flap Allowance (mm)">
                      <Input
                        type="number"
                        value={input.addWMm}
                        onChange={(e) => setInput({ ...input, addWMm: parseFloat(e.target.value) || 0 })}
                      />
                    </FormField>
                    <FormField label="Wastage (%)">
                      <Input
                        type="number"
                        step="0.5"
                        value={input.wastePercent}
                        onChange={(e) => setInput({ ...input, wastePercent: parseFloat(e.target.value) || 0 })}
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Layer-by-Layer Construction Table */}
              <Card>
                <CardHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="size-4 text-brand-600" /> Layer-by-Layer Board Construction
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Set custom GSM, Burst Factor (BF), and paper rate for each ply.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={autoFillRatesFromMatrix}
                    className="text-xs"
                  >
                    <Sparkles className="size-3.5 text-brand-600" /> Auto-fill Rates
                  </Button>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-subtle text-muted-foreground uppercase text-[10px]">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Layer Role</th>
                          <th className="p-2 w-20">BF</th>
                          <th className="p-2 w-24">GSM</th>
                          <th className="p-2 w-20">Flute Fac</th>
                          <th className="p-2 w-24">Rate (₹/kg)</th>
                          <th className="p-2 text-right">Cost/Box</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {input.layers.map((layer, idx) => {
                          const layerCost = ((result.sheetLengthInch * result.sheetWidthInch * layer.gsm * layer.fluteFactor * 645.16) / 1e9) * layer.rate;
                          return (
                            <tr key={layer.layerNum} className={layer.isFluting ? "bg-brand-50/20" : ""}>
                              <td className="p-2 font-mono text-muted-foreground">{layer.layerNum}</td>
                              <td className="p-2 font-medium">
                                <span className={layer.isFluting ? "text-brand-700 font-semibold" : ""}>
                                  {layer.role}
                                </span>
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  className="h-7 text-xs px-2"
                                  value={layer.bf}
                                  onChange={(e) => updateLayer(idx, { bf: parseFloat(e.target.value) || 0 })}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  className="h-7 text-xs px-2"
                                  value={layer.gsm}
                                  onChange={(e) => updateLayer(idx, { gsm: parseFloat(e.target.value) || 0 })}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.05"
                                  className="h-7 text-xs px-2 font-mono"
                                  value={layer.fluteFactor}
                                  disabled={!layer.isFluting}
                                  onChange={(e) => updateLayer(idx, { fluteFactor: parseFloat(e.target.value) || 1.0 })}
                                />
                              </td>
                              <td className="p-2">
                                <CurrencyInput
                                  className="h-7 text-xs px-2 font-mono"
                                  value={layer.rate}
                                  onChange={(val) => updateLayer(idx, { rate: val ?? 0 })}
                                />
                              </td>
                              <td className="p-2 text-right font-mono font-medium">
                                {formatRupees(layerCost)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Overheads Card */}
              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="size-4 text-brand-600" /> Conversion, Printing & Overheads
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid gap-3 sm:grid-cols-3">
                  <FormField label="Conversion Rate (₹/kg)">
                    <CurrencyInput
                      value={input.conversionRate}
                      onChange={(val) => setInput({ ...input, conversionRate: val ?? 0 })}
                    />
                  </FormField>
                  <FormField label="Printing Rate (₹/box)">
                    <CurrencyInput
                      value={input.printingRate}
                      onChange={(val) => setInput({ ...input, printingRate: val ?? 0 })}
                    />
                  </FormField>
                  <FormField label="Transport (₹/box)">
                    <CurrencyInput
                      value={input.transportPerBox}
                      onChange={(val) => setInput({ ...input, transportPerBox: val ?? 0 })}
                    />
                  </FormField>
                  <FormField label="Stereo / Setup Cost (₹ total)">
                    <CurrencyInput
                      value={input.setupCost}
                      onChange={(val) => setInput({ ...input, setupCost: val ?? 0 })}
                    />
                  </FormField>
                  <FormField label="Order Qty (Pcs)">
                    <Input
                      type="number"
                      value={input.orderQty}
                      onChange={(e) => setInput({ ...input, orderQty: parseInt(e.target.value) || 0 })}
                    />
                  </FormField>
                  <FormField label="Margin (%)">
                    <Input
                      type="number"
                      step="0.5"
                      value={input.profitPercent}
                      onChange={(e) => setInput({ ...input, profitPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </FormField>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Right Column: Hero Price Card & Visualizer (5 cols) */}
        <div className="space-y-5 lg:col-span-5 lg:sticky lg:top-4">
          {/* Price Summary Hero Card */}
          <Card className="border-brand-200 bg-gradient-to-b from-brand-50/40 to-card shadow-card overflow-hidden">
            <CardHeader className="border-b border-brand-100/80 pb-3 bg-brand-50/60">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-brand-700 tracking-wider uppercase">Live Cost Estimate</span>
                  <CardTitle className="text-xl font-bold text-foreground">
                    {formatRupees(result.basicPrice)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ box</span>
                  </CardTitle>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">With 12% GST</span>
                  <span className="text-sm font-semibold text-brand-800">{formatRupees(result.priceWithTax)}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Total Order Banner */}
              <div className="rounded-xl border border-brand-200/80 bg-card p-3 shadow-xs">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                  <span>Total Order ({(input.orderQty || 1000).toLocaleString("en-IN")} pcs)</span>
                  <span className="font-medium text-foreground">{formatRupees(result.priceWithTax)} ea</span>
                </div>
                <div className="text-2xl font-black tracking-tight text-brand-700 font-mono">
                  {formatRupees(result.priceWithTax * (input.orderQty || 1000))}
                </div>
              </div>

              {/* Technical Specifications Strip */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs tabular">
                <div className="rounded-lg border border-border bg-subtle p-2">
                  <span className="text-[10px] text-muted-foreground block">Box Weight</span>
                  <span className="font-semibold text-foreground">{(result.totalWeightKg * 1000).toFixed(0)} g</span>
                </div>
                <div className="rounded-lg border border-border bg-subtle p-2">
                  <span className="text-[10px] text-muted-foreground block">Burst Strength</span>
                  <span className="font-semibold text-brand-700">{result.totalBs.toFixed(1)} kg/cm²</span>
                </div>
                <div className="rounded-lg border border-border bg-subtle p-2">
                  <span className="text-[10px] text-muted-foreground block">Total GSM</span>
                  <span className="font-semibold text-foreground">{result.totalGsm.toFixed(0)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  onClick={handleSaveQuotation}
                  loading={saveQuotationMutation.isPending}
                  className="w-full text-sm font-semibold shadow-xs"
                >
                  <Save className="size-4" /> Save as Quotation
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyWhatsApp}
                  className="w-full text-xs text-brand-700 border-brand-200 hover:bg-brand-50"
                >
                  <Copy className="size-3.5" /> Copy WhatsApp Proposal
                </Button>
              </div>

              {/* Expandable Cost Breakdown Accordion */}
              <div className="border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                  className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground font-medium py-1 cursor-pointer"
                >
                  <span>Detailed Cost Breakdown</span>
                  {showCostBreakdown ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>

                {showCostBreakdown && (
                  <div className="space-y-1.5 text-xs pt-2 font-mono divide-y divide-border/60">
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Raw Paper Cost</span>
                      <span>{formatRupees(result.totalPaperCost)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Wastage ({result.taxPercent}%)</span>
                      <span>{formatRupees(result.wastageCost)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Conversion</span>
                      <span>{formatRupees(result.conversionCost)}</span>
                    </div>
                    {result.printingCost > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Printing</span>
                        <span>{formatRupees(result.printingCost)}</span>
                      </div>
                    )}
                    {result.transportCost > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Transport</span>
                        <span>{formatRupees(result.transportCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 font-semibold text-foreground">
                      <span>Total Mfg Cost</span>
                      <span>{formatRupees(result.manufacturingCost)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-brand-700">
                      <span>Profit Margin ({input.profitPercent}%)</span>
                      <span>{formatRupees(result.profitAmount, { sign: true })}</span>
                    </div>
                    <div className="flex justify-between py-1 font-bold text-foreground">
                      <span>Basic Price / Box</span>
                      <span>{formatRupees(result.basicPrice)}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Visualizer Card (3D / 2D) */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border p-3 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Interactive Preview
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-subtle p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setVisTab("3d")}
                  className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
                    visTab === "3d" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                  }`}
                >
                  3D Simulation
                </button>
                <button
                  type="button"
                  onClick={() => setVisTab("2d")}
                  className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
                    visTab === "2d" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground"
                  }`}
                >
                  2D Creasing Plan
                </button>
              </div>
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
                  addL={input.addLMm || 0}
                  addW={input.addWMm || 0}
                  unit={unitMode}
                  ply={input.ply}
                  sheetLengthInch={result.sheetLengthInch}
                  sheetWidthInch={result.sheetWidthInch}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
