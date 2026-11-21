import { Layers } from "lucide-react";

interface SheetCreasingDiagramProps {
  length: number;
  width: number;
  height: number;
  addL: number;
  addW: number;
  unit: string;
  ply: number;
  sheetLengthInch: number;
  sheetWidthInch: number;
  isEmbedded?: boolean;
}

export function SheetCreasingDiagram({
  length,
  width,
  height,
  addL,
  addW,
  unit,
  ply,
  sheetLengthInch,
  sheetWidthInch,
  isEmbedded = false,
}: SheetCreasingDiagramProps) {
  const safeL = length > 0 ? length : 300;
  const safeW = width > 0 ? width : 200;
  const safeH = height > 0 ? height : 200;
  const safeLap = addL > 0 ? addL : 50;
  const safeAddW = addW > 0 ? addW : 20;

  const displayL = length > 0 ? length : 0;
  const displayW = width > 0 ? width : 0;
  const displayH = height > 0 ? height : 0;

  const topFlap = displayW > 0 ? parseFloat(((displayW + safeAddW) / 2).toFixed(1)) : 0;
  const bottomFlap = topFlap;

  const totalLengthMm = (safeL * 2) + (safeW * 2) + safeLap;
  const svgTotalWidth = 510;

  const p1 = (safeL / totalLengthMm) * svgTotalWidth;
  const p2 = (safeW / totalLengthMm) * svgTotalWidth;
  const p3 = p1;
  const p4 = p2;
  const p5 = (safeLap / totalLengthMm) * svgTotalWidth;

  const x1 = 15;
  const x2 = x1 + p1;
  const x3 = x2 + p2;
  const x4 = x3 + p3;
  const x5 = x4 + p4;

  const safeTopFlapMm = (safeW + safeAddW) / 2;
  const totalHeightMm = (safeTopFlapMm * 2) + safeH;
  const svgSheetHeight = 110;
  const flapH = Math.max(20, Math.min(36, (safeTopFlapMm / totalHeightMm) * svgSheetHeight));
  const yTop = 20 + flapH;
  const yBtm = 20 + svgSheetHeight - flapH;

  const plyConfig = {
    3: { name: "Single Wall (3-Ply)", flutes: 1, caliper: "3.2 mm", fluteName: "Universal B-Flute" },
    5: { name: "Double Wall (5-Ply)", flutes: 2, caliper: "6.5 mm", fluteName: "Heavy AB-Flute" },
    7: { name: "Triple Wall (7-Ply)", flutes: 3, caliper: "10.5 mm", fluteName: "Triple AAA-Flute" },
    9: { name: "Quad Wall (9-Ply)", flutes: 4, caliper: "14.5 mm", fluteName: "Heavy Quad Duty" },
  }[ply] || { name: `${ply}-Ply Board`, flutes: 1, caliper: "3.0 mm", fluteName: "Corrugated Board" };

  const generateFluteWavePath = (yBase: number, amplitude: number, wavelength: number, totalW: number) => {
    let path = `M 15 ${yBase}`;
    const steps = Math.floor(totalW / wavelength);
    for (let i = 0; i < steps; i++) {
      const startX = 15 + i * wavelength;
      const midX = startX + wavelength / 2;
      const endX = startX + wavelength;
      path += ` Q ${startX + wavelength / 4} ${yBase - amplitude}, ${midX} ${yBase}`;
      path += ` Q ${midX + wavelength / 4} ${yBase + amplitude}, ${endX} ${yBase}`;
    }
    return path;
  };

  const numFlutes = plyConfig.flutes;

  const content = (
    <div className="space-y-3 font-sans">
      {!isEmbedded && (
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-brand-600" />
            <span className="text-xs font-semibold">2D Machine Creasing Blueprint</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-700 font-semibold">
              {plyConfig.name}
            </span>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            Sheet Blank: <strong className="text-foreground">{sheetLengthInch.toFixed(2)}&quot; × {sheetWidthInch.toFixed(2)}&quot;</strong>
          </div>
        </div>
      )}

      {/* SVG 2D Flat Sheet Layout */}
      <div className="bg-subtle border border-border rounded-xl p-4 overflow-x-auto">
        <svg viewBox="0 0 540 160" className="w-full h-auto min-w-[500px] text-xs font-mono select-none">
          {/* Outer Sheet Blank Boundary */}
          <rect
            x="15"
            y="20"
            width={svgTotalWidth}
            height={svgSheetHeight}
            className="fill-card stroke-border"
            strokeWidth="1.5"
            rx="4"
          />

          {/* Panel 1: L */}
          <rect x={x1} y="20" width={p1} height={svgSheetHeight} fill="var(--color-brand-50, #fbf4ea)" opacity="0.6" />
          <line x1={x2} y1="20" x2={x2} y2={20 + svgSheetHeight} stroke="var(--border)" strokeWidth="1.5" />
          <text x={x1 + p1 / 2} y="78" className="fill-foreground font-bold" textAnchor="middle" fontSize="12">L: {displayL} {unit}</text>
          <text x={x1 + p1 / 2} y={20 + flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Flap ({topFlap})</text>
          <text x={x1 + p1 / 2} y={20 + svgSheetHeight - flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Flap ({bottomFlap})</text>

          {/* Panel 2: W */}
          <rect x={x2} y="20" width={p2} height={svgSheetHeight} fill="var(--color-subtle, #f8f9fa)" opacity="0.4" />
          <line x1={x3} y1="20" x2={x3} y2={20 + svgSheetHeight} stroke="var(--border)" strokeWidth="1.5" />
          <text x={x2 + p2 / 2} y="78" className="fill-foreground font-bold" textAnchor="middle" fontSize="12">W: {displayW} {unit}</text>
          <text x={x2 + p2 / 2} y={20 + flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Top Flap</text>
          <text x={x2 + p2 / 2} y={20 + svgSheetHeight - flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Btm Flap</text>

          {/* Panel 3: L */}
          <rect x={x3} y="20" width={p3} height={svgSheetHeight} fill="var(--color-brand-50, #fbf4ea)" opacity="0.6" />
          <line x1={x4} y1="20" x2={x4} y2={20 + svgSheetHeight} stroke="var(--border)" strokeWidth="1.5" />
          <text x={x3 + p3 / 2} y="78" className="fill-foreground font-bold" textAnchor="middle" fontSize="12">L: {displayL} {unit}</text>
          <text x={x3 + p3 / 2} y={20 + flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Flap</text>
          <text x={x3 + p3 / 2} y={20 + svgSheetHeight - flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Flap</text>

          {/* Panel 4: W */}
          <rect x={x4} y="20" width={p4} height={svgSheetHeight} fill="var(--color-subtle, #f8f9fa)" opacity="0.4" />
          <line x1={x5} y1="20" x2={x5} y2={20 + svgSheetHeight} stroke="var(--border)" strokeWidth="1.5" />
          <text x={x4 + p4 / 2} y="78" className="fill-foreground font-bold" textAnchor="middle" fontSize="12">W: {displayW} {unit}</text>
          <text x={x4 + p4 / 2} y={20 + flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Top Flap</text>
          <text x={x4 + p4 / 2} y={20 + svgSheetHeight - flapH / 2 + 3} className="fill-muted-foreground font-medium" textAnchor="middle" fontSize="10.5">Btm Flap</text>

          {/* Panel 5: Joint Lap */}
          <rect x={x5} y="20" width={p5} height={svgSheetHeight} fill="var(--color-brand-100, #f5e4cc)" />
          <text x={x5 + p5 / 2} y="78" className="fill-brand-700 font-bold" textAnchor="middle" fontSize="10">Lap {addL}</text>

          {/* Horizontal Flap Crease Lines (Dashed) */}
          <line x1="15" y1={yTop} x2={15 + svgTotalWidth} y2={yTop} stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4,3" />
          <line x1="15" y1={yBtm} x2={15 + svgTotalWidth} y2={yBtm} stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4,3" />

          {/* Vertical Height Dimension Label */}
          <text x="8" y="78" className="fill-muted-foreground font-bold" textAnchor="end" fontSize="10.5">H: {displayH}</text>
        </svg>

        {/* Board Edge Cross-Section Visualizer */}
        <div className="pt-3 border-t border-border mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <span>Board Edge Cross-Section:</span>
              <span className="text-brand-600 font-bold">{plyConfig.name} ({numFlutes} Fluting Mediums + {numFlutes + 1} Liners)</span>
            </span>
            <span className="text-muted-foreground font-medium">Caliper: ~{plyConfig.caliper}</span>
          </div>

          <svg viewBox="0 0 540 38" className="w-full h-10 bg-card rounded-lg border border-border shadow-xs">
            {/* Flat Liner Layer Lines */}
            {Array.from({ length: numFlutes + 1 }).map((_, idx) => {
              const y = 6 + idx * (26 / numFlutes);
              const isOuter = idx === 0 || idx === numFlutes;
              return (
                <line
                  key={`liner-${idx}`}
                  x1="15"
                  y1={y}
                  x2="525"
                  y2={y}
                  stroke={isOuter ? "#b57224" : "#94a3b8"}
                  strokeWidth={isOuter ? "2" : "1.2"}
                />
              );
            })}

            {/* Wavy Sinusoidal Fluting Medium Waves */}
            {Array.from({ length: numFlutes }).map((_, idx) => {
              const yMid = 6 + idx * (26 / numFlutes) + (26 / numFlutes) / 2;
              const waveAmp = (26 / numFlutes) * 0.42;
              return (
                <path
                  key={`flute-${idx}`}
                  d={generateFluteWavePath(yMid, waveAmp, 14, 510)}
                  fill="none"
                  stroke="#9a5a1e"
                  strokeWidth="1.3"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Board Cross-Section & Creasing Measurements Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="bg-card p-3 rounded-lg border border-border space-y-1 shadow-xs">
          <span className="text-xs text-muted-foreground font-sans block font-medium">Flute Specification</span>
          <div className="text-foreground font-bold flex items-center justify-between text-sm">
            <span>{plyConfig.fluteName}</span>
            <span className="text-brand-600">~{plyConfig.caliper}</span>
          </div>
        </div>

        <div className="bg-card p-3 rounded-lg border border-border space-y-1 shadow-xs">
          <span className="text-xs text-muted-foreground font-sans block font-medium">Lengthwise Machine Scoring</span>
          <div className="text-foreground font-bold text-sm truncate">
            {displayL} + {displayW} + {displayL} + {displayW} + {addL} {unit}
          </div>
        </div>

        <div className="bg-card p-3 rounded-lg border border-border space-y-1 shadow-xs">
          <span className="text-xs text-muted-foreground font-sans block font-medium">Widthwise Flap Scoring</span>
          <div className="text-foreground font-bold text-sm truncate">
            {topFlap} + {displayH} + {bottomFlap} {unit}
          </div>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
      {content}
    </div>
  );
}
