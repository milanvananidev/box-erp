import { useState } from "react";
import { Rotate3d, Play, Pause } from "lucide-react";

interface BoxVisualizer3DProps {
  length: number;
  width: number;
  height: number;
  unit: string;
  ply: number;
}

export function BoxVisualizer3D({
  length,
  width,
  height,
  unit,
  ply,
}: BoxVisualizer3DProps) {
  const [isRotating, setIsRotating] = useState(true);
  const [rotX, setRotX] = useState(-20);
  const [rotY, setRotY] = useState(35);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [foldProgress, setFoldProgress] = useState(100);
  const [finishType, setFinishType] = useState<"kraft" | "white" | "printed">("kraft");

  const rawL = length > 0 ? length : 300;
  const rawW = width > 0 ? width : 200;
  const rawH = height > 0 ? height : 200;

  const maxDim = Math.max(rawL, rawW, rawH, 1);
  const scale = 175 / maxDim;

  const boxL = Math.max(60, Math.min(220, rawL * scale));
  const boxW = Math.max(40, Math.min(180, rawW * scale));
  const boxH = Math.max(40, Math.min(190, rawH * scale));

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setRotY((prev) => prev + dx * 0.8);
    setRotX((prev) => Math.max(-80, Math.min(80, prev - dy * 0.8)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const finishStyles = {
    kraft: {
      front: "linear-gradient(135deg, #d49759 0%, #b87c3e 100%)",
      back: "linear-gradient(135deg, #a46c2f 0%, #8b5822 100%)",
      side: "linear-gradient(135deg, #c08547 0%, #a46e35 100%)",
      top: "linear-gradient(135deg, #e0a768 0%, #c48c4d 100%)",
      border: "border-amber-900/60",
      textColor: "text-amber-950",
      badge: "bg-amber-200/50 border-amber-900/20 text-amber-950",
    },
    white: {
      front: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)",
      back: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)",
      side: "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)",
      top: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
      border: "border-slate-400",
      textColor: "text-slate-900",
      badge: "bg-slate-200 border-slate-300 text-slate-900",
    },
    printed: {
      front: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
      back: "linear-gradient(135deg, #075985 0%, #0c4a6e 100%)",
      side: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
      top: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
      border: "border-sky-900/60",
      textColor: "text-white",
      badge: "bg-sky-900/40 border-sky-400/30 text-white",
    },
  }[finishType];

  const flapTopAngle = 90 * (foldProgress / 100);
  const flapBtmAngle = -90 * (foldProgress / 100);
  const sideFoldAngle = 90 * (foldProgress / 100);

  return (
    <div className="relative rounded-xl border border-border bg-subtle p-4 overflow-hidden select-none flex flex-col justify-between min-h-[380px] lg:h-[420px] shadow-xs">
      {/* Visualizer Header */}
      <div className="flex items-center justify-between z-10 gap-2 font-sans">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-xs font-bold">3D Simulation</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-700 font-bold">
            {ply}-Ply Kraft
          </span>
        </div>

        {/* Finish Selector Buttons */}
        <div className="flex items-center gap-1 bg-card p-0.5 rounded-lg border border-border text-[10px]">
          <button
            type="button"
            onClick={() => setFinishType("kraft")}
            className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
              finishType === "kraft" ? "bg-brand-600 text-white font-bold" : "text-muted-foreground"
            }`}
          >
            Kraft
          </button>
          <button
            type="button"
            onClick={() => setFinishType("white")}
            className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
              finishType === "white" ? "bg-slate-700 text-white font-bold" : "text-muted-foreground"
            }`}
          >
            White
          </button>
          <button
            type="button"
            onClick={() => setFinishType("printed")}
            className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
              finishType === "printed" ? "bg-sky-600 text-white font-bold" : "text-muted-foreground"
            }`}
          >
            Printed
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsRotating(!isRotating)}
            className={`p-1 rounded text-xs transition cursor-pointer border ${
              isRotating
                ? "bg-brand-50 text-brand-700 border-brand-300"
                : "bg-card text-muted-foreground border-border"
            }`}
            title={isRotating ? "Pause Auto-Rotation" : "Start Auto-Rotation"}
          >
            {isRotating ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setRotX(-20);
              setRotY(35);
            }}
            className="p-1 rounded bg-card text-muted-foreground hover:text-foreground border border-border transition cursor-pointer"
            title="Reset 3D Angle"
          >
            <Rotate3d className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Scene Viewport */}
      <div
        className="flex-1 flex items-center justify-center cursor-grab active:cursor-grabbing relative"
        style={{ perspective: "900px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Soft Radial Floor Shadow */}
        <div
          className="absolute bottom-4 w-44 h-10 rounded-full pointer-events-none opacity-40"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, transparent 70%)",
            transform: "rotateX(60deg)",
          }}
        />

        <div
          className={`relative transition-transform duration-75 ease-out ${
            isRotating && !isDragging ? "animate-box-spin" : ""
          }`}
          style={{
            width: `${boxL}px`,
            height: `${boxH}px`,
            transformStyle: "preserve-3d",
            transform: isRotating && !isDragging ? undefined : `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          }}
        >
          {/* Front Face (L x H) */}
          <div
            className={`absolute inset-0 border shadow-inner flex flex-col justify-between p-2 rounded-xs ${finishStyles.border}`}
            style={{
              width: `${boxL}px`,
              height: `${boxH}px`,
              background: finishStyles.front,
              transform: `translateZ(${boxW / 2}px)`,
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.25)",
            }}
          >
            <div className={`flex justify-between items-center text-[9px] font-bold uppercase tracking-wider ${finishStyles.textColor}`}>
              <span>↑ THIS SIDE UP</span>
              <span>📦</span>
            </div>
            <div className="border-t border-dashed border-current opacity-40 w-full my-auto" />
            <div className={`text-[10px] font-mono font-bold text-center rounded py-0.5 border ${finishStyles.badge}`}>
              L: {length || 0} {unit}
            </div>
          </div>

          {/* Back Face (L x H) */}
          <div
            className={`absolute inset-0 border p-2 ${finishStyles.border}`}
            style={{
              width: `${boxL}px`,
              height: `${boxH}px`,
              background: finishStyles.back,
              transform: `rotateY(180deg) translateZ(${boxW / 2}px)`,
              boxShadow: "inset 0 0 20px rgba(0,0,0,0.4)",
            }}
          />

          {/* Right Face (W x H) */}
          <div
            className={`absolute inset-0 border p-2 flex flex-col justify-between ${finishStyles.border}`}
            style={{
              width: `${boxW}px`,
              height: `${boxH}px`,
              left: `${(boxL - boxW) / 2}px`,
              background: finishStyles.side,
              transform: `rotateY(${sideFoldAngle}deg) translateZ(${boxL / 2}px)`,
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.3)",
            }}
          >
            <div className={`text-[8px] font-mono font-bold ${finishStyles.textColor}`}>W: {width || 0}</div>
            <div className={`text-[9px] font-mono text-center font-bold ${finishStyles.textColor}`}>
              H: {height || 0}
            </div>
          </div>

          {/* Left Face (W x H) */}
          <div
            className={`absolute inset-0 border p-2 ${finishStyles.border}`}
            style={{
              width: `${boxW}px`,
              height: `${boxH}px`,
              left: `${(boxL - boxW) / 2}px`,
              background: finishStyles.side,
              transform: `rotateY(-${sideFoldAngle}deg) translateZ(${boxL / 2}px)`,
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.35)",
            }}
          />

          {/* Top Flap (L x W) */}
          <div
            className={`absolute inset-0 border p-1 flex items-center justify-center transition-transform duration-200 ${finishStyles.border}`}
            style={{
              width: `${boxL}px`,
              height: `${boxW}px`,
              top: `${(boxH - boxW) / 2}px`,
              background: finishStyles.top,
              transform: `rotateX(${flapTopAngle}deg) translateZ(${boxH / 2}px)`,
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.2)",
            }}
          >
            <div className="h-4 w-full bg-amber-100/60 border-y border-amber-900/30 flex items-center justify-center">
              <span className="text-[8px] font-mono font-bold text-amber-950/80 tracking-widest">
                SEALED TAPE
              </span>
            </div>
          </div>

          {/* Bottom Flap (L x W) */}
          <div
            className={`absolute inset-0 border p-1 transition-transform duration-200 ${finishStyles.border}`}
            style={{
              width: `${boxL}px`,
              height: `${boxW}px`,
              top: `${(boxH - boxW) / 2}px`,
              background: finishStyles.back,
              transform: `rotateX(${flapBtmAngle}deg) translateZ(${boxH / 2}px)`,
              boxShadow: "0 25px 30px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      </div>

      {/* Interactive Fold Slider */}
      <div className="space-y-1.5 z-10 font-sans">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-2.5 py-1 text-[11px] font-mono shadow-xs">
          <span className="text-muted-foreground font-sans text-[10px] flex-none">3D Fold: {foldProgress}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={foldProgress}
            onChange={(e) => setFoldProgress(parseInt(e.target.value, 10))}
            className="w-full accent-brand-500 cursor-pointer h-1.5 bg-border rounded"
            title="Slide to fold/unfold 3D corrugated box flaps"
          />
          <span className="text-[10px] text-brand-600 font-semibold flex-none">
            {foldProgress === 100 ? "Closed Box" : foldProgress === 0 ? "Flat Blank" : "Folding"}
          </span>
        </div>
      </div>
    </div>
  );
}
