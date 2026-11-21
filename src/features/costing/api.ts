import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { command } from "@/lib/ipc";

export interface PaperLayer {
  layerNum: number;
  role: string;
  isFluting: boolean;
  bf: number;
  gsm: number;
  rate: number;
  fluteFactor: number;
  weightKg?: number;
  costRs?: number;
}

export interface IPaperRateItem {
  id: string;
  bf: number;
  minGsm: number;
  maxGsm: number;
  ratePerKg: number;
  paperType: string;
}

export interface CorrugatedBoxInput {
  boxNo?: string | number;
  date?: string;
  client?: string;
  cName?: string;
  boxName?: string;
  remark?: string;
  unitMode?: "mm" | "inch";

  lengthMm: number;
  widthMm: number;
  heightMm: number;
  ply: number;
  layers: PaperLayer[];

  addLMm?: number;
  addWMm?: number;
  ups?: number;

  wastePercent?: number;
  conversionRate?: number;
  convType?: number;
  printingRate?: number;
  transportPerBox?: number;
  laminationPerBox?: number;
  partitionCost?: number;
  setupCost?: number;
  orderQty?: number;
  profitPercent?: number;
  taxPercent?: number;
}

export interface CorrugatedBoxResult {
  sheetLengthInch: number;
  sheetWidthInch: number;
  sheetAreaSqm: number;
  inMmL: number;
  inMmW: number;

  layers: PaperLayer[];
  totalGsm: number;
  totalBs: number;
  totalWeightKg: number;
  totalPaperWeightKg: number;
  totalPaperCost: number;

  wastageCost: number;
  conversionCost: number;
  printingCost: number;
  transportCost: number;
  laminationCost: number;
  partitionCost: number;
  setupCostPerBox: number;

  manufacturingCost: number;
  baseManufacturingCost: number;
  profitAmount: number;
  basicPrice: number;
  taxPercent: number;
  taxAmount: number;
  finalBoxRate: number;
  priceWithTax: number;
}

export interface IQuotation {
  id: string;
  quotationNumber: string;
  clientId?: string;
  clientName: string;
  boxName: string;
  date: string;
  status: "DRAFT" | "SENT" | "APPROVED" | "DECLINED";
  unitMode: "mm" | "inch";
  input: CorrugatedBoxInput;
  result: CorrugatedBoxResult;
  quantity: number;
  basicPrice: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

export const DEFAULT_PAPER_RATES: IPaperRateItem[] = [
  { id: "r1", bf: 14, minGsm: 100, maxGsm: 140, ratePerKg: 32, paperType: "Semi Kraft" },
  { id: "r2", bf: 16, minGsm: 140, maxGsm: 180, ratePerKg: 36, paperType: "Medium Kraft" },
  { id: "r3", bf: 18, minGsm: 140, maxGsm: 180, ratePerKg: 42, paperType: "Virgin Fluting" },
  { id: "r4", bf: 22, minGsm: 180, maxGsm: 220, ratePerKg: 48, paperType: "High BF Kraft" },
  { id: "r5", bf: 28, minGsm: 200, maxGsm: 260, ratePerKg: 54, paperType: "Test Liner" },
];

export function createStandardLayers(plyCount: number): PaperLayer[] {
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
      bf: isFluting ? 14 : 16,
      gsm: isFluting ? 120 : 150,
      fluteFactor: isFluting ? 1.5 : 1.0,
      rate: isFluting ? 34 : 38,
    });
  }
  return newLayers;
}

export function calculateBoxCost(inp: CorrugatedBoxInput): CorrugatedBoxResult {
  const L = inp.lengthMm || 0;
  const W = inp.widthMm || 0;
  const H = inp.heightMm || 0;
  const addL = inp.addLMm ?? 50.0;
  const addWMm = inp.addWMm ?? 20.0;
  const ups = Math.max(1, inp.ups ?? 1.0);

  const wastePercent = inp.wastePercent ?? 3.0;
  const convType = inp.convType ?? 1;
  const conversionRate = inp.conversionRate ?? 10.0;
  const printingRate = inp.printingRate ?? 0.0;
  const transportPerBox = inp.transportPerBox ?? 0.0;
  const laminationPerBox = inp.laminationPerBox ?? 0.0;
  const partitionCost = inp.partitionCost ?? 0.0;
  const setupCost = inp.setupCost ?? 0.0;
  const orderQty = Math.max(1, inp.orderQty ?? 1000);
  const profitPercent = inp.profitPercent ?? 10.0;
  const taxPercent = inp.taxPercent ?? 12.0;

  // 1. Dimensions in mm
  const inMmL = Math.round(((L + W) * 2.0 + addL) * 100) / 100;
  const inMmW = Math.round((W + H + addWMm) * 100) / 100;

  // 2. Sheet Dimensions in Inches
  const sheetLengthInch = Math.round((inMmL / 25.4) * 100) / 100;
  const sheetWidthInch = Math.round((inMmW / 25.4) * 100) / 100;
  const sheetAreaSqm = (sheetLengthInch * 25.4 * sheetWidthInch * 25.4) / 1_000_000.0;

  // 3. Layer Weight and Paper Cost Calculations
  let totalWeight = 0.0;
  let totalPaperCost = 0.0;
  let totalGsm = 0;
  let totalBsSum = 0.0;

  const calculatedLayers: PaperLayer[] = (inp.layers || []).map((layer, idx) => {
    const ff = layer.isFluting ? (layer.fluteFactor || 1.5) : 1.0;
    const gsmVal = Math.max(0, layer.gsm || 0);
    const rateVal = Math.max(0, layer.rate || 0);
    const bfVal = Math.max(0, layer.bf || 0);

    const wt = (sheetLengthInch * sheetWidthInch * gsmVal * ff * 25.4 * 25.4) / 1_000_000_000.0;
    const cost = wt * rateVal;

    totalWeight += wt;
    totalPaperCost += cost;
    totalGsm += gsmVal;
    totalBsSum += (gsmVal * bfVal);

    return {
      ...layer,
      layerNum: layer.layerNum || idx + 1,
      bf: bfVal,
      gsm: gsmVal,
      rate: rateVal,
      fluteFactor: ff,
      weightKg: Math.round(wt * 10000) / 10000,
      costRs: Math.round(cost * 100) / 100,
    };
  });

  totalWeight = Math.round(totalWeight * 1000) / 1000;
  totalPaperCost = Math.round(totalPaperCost * 100) / 100;
  const totalBs = Math.round((totalBsSum / 1000.0) * 100) / 100;

  // 4. Overheads
  const wastageCost = Math.round((totalPaperCost * (wastePercent / 100.0)) * 100) / 100;
  const conversionCost = convType === 1
    ? Math.round((conversionRate * totalWeight) * 100) / 100
    : Math.round((conversionRate / ups) * 100) / 100;

  const printingCost = Math.round((printingRate / ups) * 100) / 100;
  const setupCostPerBox = setupCost > 0 ? Math.round((setupCost / orderQty) * 100) / 100 : 0.0;
  const extraCosts = Math.round((transportPerBox + laminationPerBox + partitionCost + setupCostPerBox) * 100) / 100;

  // 5. Manufacturing Cost & Profit
  const manufacturingCost = Math.round((totalPaperCost + wastageCost + conversionCost + printingCost + extraCosts) * 100) / 100;
  const baseManufacturingCost = manufacturingCost;
  const profitAmount = Math.round((manufacturingCost * (profitPercent / 100.0)) * 100) / 100;
  const basicPrice = Math.round((manufacturingCost + profitAmount) * 100) / 100;
  const finalBoxRate = basicPrice;

  // 6. Tax
  const taxAmount = Math.round((basicPrice * (taxPercent / 100.0)) * 100) / 100;
  const priceWithTax = Math.round((basicPrice + taxAmount) * 100) / 100;

  return {
    sheetLengthInch,
    sheetWidthInch,
    sheetAreaSqm: Math.round(sheetAreaSqm * 10000) / 10000,
    inMmL,
    inMmW,
    layers: calculatedLayers,
    totalGsm,
    totalBs,
    totalWeightKg: totalWeight,
    totalPaperWeightKg: totalWeight,
    totalPaperCost,
    wastageCost,
    conversionCost,
    printingCost,
    transportCost: transportPerBox,
    laminationCost: laminationPerBox,
    partitionCost,
    setupCostPerBox,
    manufacturingCost,
    baseManufacturingCost,
    profitAmount,
    basicPrice,
    taxPercent,
    taxAmount,
    finalBoxRate,
    priceWithTax,
  };
}

export const PRESETS: Record<string, { id: string; name: string; config: CorrugatedBoxInput }> = {
  "5ply_standard": {
    id: "5ply_standard",
    name: "5-Ply Master Carton (Standard)",
    config: {
      boxNo: "1",
      date: new Date().toISOString().split("T")[0],
      boxName: "5-Ply Master Shipper Carton",
      remark: "Universal Standard",
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
      layers: [
        { layerNum: 1, role: "Top Liner (Face)", isFluting: false, bf: 16, gsm: 150, rate: 38.0, fluteFactor: 1.0 },
        { layerNum: 2, role: "Fluting 1 (Nali)", isFluting: true, bf: 14, gsm: 120, rate: 34.0, fluteFactor: 1.5 },
        { layerNum: 3, role: "Center Liner", isFluting: false, bf: 14, gsm: 120, rate: 34.0, fluteFactor: 1.0 },
        { layerNum: 4, role: "Fluting 2 (Nali)", isFluting: true, bf: 14, gsm: 120, rate: 34.0, fluteFactor: 1.5 },
        { layerNum: 5, role: "Bottom Liner", isFluting: false, bf: 16, gsm: 150, rate: 38.0, fluteFactor: 1.0 },
      ],
    },
  },
  "3ply_small": {
    id: "3ply_small",
    name: "3-Ply E-Commerce Shipper Box",
    config: {
      boxNo: "2",
      date: new Date().toISOString().split("T")[0],
      boxName: "3-Ply E-Commerce Box",
      remark: "Single Wall E-Com",
      lengthMm: 200,
      widthMm: 150,
      heightMm: 100,
      ply: 3,
      addLMm: 40,
      addWMm: 15,
      ups: 1,
      wastePercent: 3.0,
      conversionRate: 8.0,
      convType: 1,
      printingRate: 0.5,
      transportPerBox: 0.2,
      laminationPerBox: 0.0,
      partitionCost: 0.0,
      setupCost: 0.0,
      orderQty: 2000,
      profitPercent: 12.0,
      taxPercent: 12.0,
      layers: [
        { layerNum: 1, role: "Top Liner (Face)", isFluting: false, bf: 18, gsm: 140, rate: 36.0, fluteFactor: 1.0 },
        { layerNum: 2, role: "Fluting (Nali)", isFluting: true, bf: 14, gsm: 120, rate: 34.0, fluteFactor: 1.5 },
        { layerNum: 3, role: "Bottom Liner", isFluting: false, bf: 14, gsm: 120, rate: 34.0, fluteFactor: 1.0 },
      ],
    },
  },
  "7ply_heavy": {
    id: "7ply_heavy",
    name: "7-Ply Heavy Industrial Box",
    config: {
      boxNo: "3",
      date: new Date().toISOString().split("T")[0],
      boxName: "7-Ply Industrial Shipper",
      remark: "Triple Wall Heavy",
      lengthMm: 450,
      widthMm: 350,
      heightMm: 300,
      ply: 7,
      addLMm: 60,
      addWMm: 30,
      ups: 1,
      wastePercent: 4.0,
      conversionRate: 12.0,
      convType: 1,
      printingRate: 1.0,
      transportPerBox: 1.5,
      laminationPerBox: 0.0,
      partitionCost: 0.0,
      setupCost: 500.0,
      orderQty: 500,
      profitPercent: 12.0,
      taxPercent: 12.0,
      layers: [
        { layerNum: 1, role: "Top Liner (Face)", isFluting: false, bf: 24, gsm: 230, rate: 42.0, fluteFactor: 1.0 },
        { layerNum: 2, role: "Fluting 1 (Nali)", isFluting: true, bf: 16, gsm: 140, rate: 36.0, fluteFactor: 1.5 },
        { layerNum: 3, role: "Center Liner 1", isFluting: false, bf: 18, gsm: 150, rate: 38.0, fluteFactor: 1.0 },
        { layerNum: 4, role: "Fluting 2 (Nali)", isFluting: true, bf: 16, gsm: 140, rate: 36.0, fluteFactor: 1.5 },
        { layerNum: 5, role: "Center Liner 2", isFluting: false, bf: 18, gsm: 150, rate: 38.0, fluteFactor: 1.0 },
        { layerNum: 6, role: "Fluting 3 (Nali)", isFluting: true, bf: 16, gsm: 140, rate: 36.0, fluteFactor: 1.5 },
        { layerNum: 7, role: "Bottom Liner", isFluting: false, bf: 24, gsm: 230, rate: 42.0, fluteFactor: 1.0 },
      ],
    },
  },
};

// Fallback in-memory cache for browser preview
const MOCK_STORAGE = {
  quotations: [] as IQuotation[],
  paperRates: [...DEFAULT_PAPER_RATES] as IPaperRateItem[],
};

export function useQuotations() {
  return useQuery({
    queryKey: ["costing-quotations"],
    queryFn: () => command<IQuotation[]>("quotations_list", undefined, () => MOCK_STORAGE.quotations),
  });
}

export function useSaveQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IQuotation) =>
      command<IQuotation>("quotation_save", { input }, () => {
        const idx = MOCK_STORAGE.quotations.findIndex((q) => q.id === input.id);
        if (idx >= 0) {
          MOCK_STORAGE.quotations[idx] = input;
        } else {
          MOCK_STORAGE.quotations.unshift(input);
        }
        return input;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costing-quotations"] });
    },
  });
}

export function useDeleteQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      command<string>("quotation_delete", { id }, () => {
        MOCK_STORAGE.quotations = MOCK_STORAGE.quotations.filter((q) => q.id !== id);
        return id;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costing-quotations"] });
    },
  });
}

export function usePaperRates() {
  return useQuery({
    queryKey: ["costing-paper-rates"],
    queryFn: () => command<IPaperRateItem[]>("paper_rates_get", undefined, () => MOCK_STORAGE.paperRates),
  });
}

export function useSavePaperRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rates: IPaperRateItem[]) =>
      command<IPaperRateItem[]>("paper_rates_save", { rates }, () => {
        MOCK_STORAGE.paperRates = [...rates];
        return rates;
      }),
    onSuccess: (data) => {
      qc.setQueryData(["costing-paper-rates"], data);
      qc.invalidateQueries({ queryKey: ["costing-paper-rates"] });
    },
  });
}
