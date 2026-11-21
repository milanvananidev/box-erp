import { cn } from "@/lib/utils";

/** Circular progress ring with centred label (used for completion & attendance). */
export function RingGauge({
  value,
  size = 160,
  stroke = 18,
  color = "var(--chart-brand)",
  track = "var(--chart-track)",
  label,
  sublabel,
  className,
}: {
  value: number; // 0–100
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${v.toFixed(1)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[26px] leading-none font-bold tracking-tight tabular">{label}</span>
        {sublabel && <span className="mt-1.5 text-[13px] text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}
