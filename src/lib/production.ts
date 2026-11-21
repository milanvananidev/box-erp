import type { BoxSpec, ProductionOrder, ProductionStage, WastageReason } from "@/types/domain";

/** Shop-floor sequence. Printing is skipped for plain boxes. */
export const STAGE_FLOW: ProductionStage[] = ["planned", "corrugation", "printing", "cutting", "pasting", "bundling", "completed"];

export const STAGE_LABEL: Record<ProductionStage, string> = {
  planned: "Planned",
  corrugation: "Corrugation",
  printing: "Printing",
  cutting: "Die Cutting",
  pasting: "Pasting / Stitching",
  bundling: "Bundling",
  completed: "Completed",
  on_hold: "On Hold",
};

export const WASTAGE_REASONS: Record<WastageReason, string> = {
  board_defect: "Board defect / warp",
  print_misregister: "Print misregister",
  die_cut_error: "Die-cut error",
  machine_setup: "Machine setup",
  handling_damage: "Handling damage",
  other: "Other",
};

export function stagesFor(spec: Pick<BoxSpec, "printed">): ProductionStage[] {
  return STAGE_FLOW.filter((s) => s !== "printing" || spec.printed);
}

/** The working stage for an order (resolves on-hold to where it stopped). */
export const workingStage = (o: Pick<ProductionOrder, "stage" | "heldFromStage">) =>
  o.stage === "on_hold" ? (o.heldFromStage ?? "planned") : o.stage;

export function nextStage(o: Pick<ProductionOrder, "stage" | "heldFromStage" | "spec">): ProductionStage | null {
  const flow = stagesFor(o.spec);
  const i = flow.indexOf(workingStage(o));
  return i >= 0 && i < flow.length - 1 ? flow[i + 1]! : null;
}

export const isActive = (o: Pick<ProductionOrder, "stage">) => o.stage !== "completed";

/** Layers in a board: 3-ply = 2 liners + 1 flute, 5-ply = 3 + 2, 7-ply = 4 + 3 */
export const layers = (ply: BoxSpec["ply"]) => ({ liners: (ply + 1) / 2, flutes: (ply - 1) / 2 });

/** Flute take-up factor: metres of medium per metre of board */
const TAKE_UP: Record<BoxSpec["flute"], number> = { A: 1.54, B: 1.36, C: 1.46, E: 1.27, BC: 1.41 };

/** Board thickness allowance per side (mm) added to inner dimensions */
const CALIPER: Record<BoxSpec["flute"], number> = { A: 5, B: 3, C: 4, E: 1.5, BC: 7 };

/**
 * Regular Slotted Container (RSC, FEFCO 0201) blank size in mm.
 *  length (cutting) = 2L + 2W + glue/stitch flap (35 mm) + caliper allowance
 *  width  (deckle)  = H + W (two half-width flaps top and bottom) + caliper allowance
 * Good enough for planning; the corrugator operator applies machine trims.
 */
export function blankSize(spec: BoxSpec) {
  const t = CALIPER[spec.flute];
  return {
    lengthMm: Math.round(2 * spec.lengthMm + 2 * spec.widthMm + 35 + 4 * t),
    widthMm: Math.round(spec.heightMm + spec.widthMm + 2 * t),
  };
}

/**
 * Approximate paper per box (grams). Uses the same GSM for every layer,
 * which matches how most orders here are quoted ("5 ply, 150 GSM").
 */
export function paperPerBox(spec: BoxSpec) {
  const b = blankSize(spec);
  const area = (b.lengthMm / 1000) * (b.widthMm / 1000);
  const { liners, flutes } = layers(spec.ply);
  const gsmTotal = liners * spec.gsm + flutes * spec.gsm * TAKE_UP[spec.flute];
  return Math.round(area * gsmTotal);
}

export const formatSize = (s: Pick<BoxSpec, "lengthMm" | "widthMm" | "heightMm">) => `${s.lengthMm}×${s.widthMm}×${s.heightMm} mm`;

export const specLine = (s: BoxSpec) =>
  `${s.ply} ply · ${s.flute} flute · ${s.gsm} GSM${s.printed ? ` · ${s.colors ?? 1}-colour print` : " · Plain"}`;
