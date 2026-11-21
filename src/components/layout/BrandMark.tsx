import { cn } from "@/lib/utils";

/** Isometric carton logo. Pure SVG so it stays crisp at any DPI. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-10", className)} aria-hidden>
      <path fill="#d9a062" d="m6 18 26-12 26 12-26 12z" />
      <path fill="#c48a47" d="M32 30v28L6 46V18z" />
      <path fill="#a56d33" d="M32 30v28l26-12V18z" />
      <path fill="#8a5a28" d="m18 12 26 12v9l-6-2.8V25.6L12 14.8z" />
      <path fill="#f0c28d" opacity=".55" d="M6 18 0 26l26 12 6-8z" />
      <path fill="#e7b277" opacity=".55" d="m58 18 6 8-26 12-6-8z" />
    </svg>
  );
}

export function BrandWordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
      <BrandMark className="size-10 shrink-0" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="text-[22px] font-bold tracking-tight text-white">
            Box<span className="text-brand-400">ERP</span>
          </div>
          <div className="truncate text-[11px] text-sidebar-muted">Corrugated Packaging ERP</div>
        </div>
      )}
    </div>
  );
}

/** Decorative stack of corrugated board + roll for the bottom of the sidebar. */
export function CorrugatedArt({ className }: { className?: string }) {
  const sheets = Array.from({ length: 7 });
  return (
    <svg viewBox="0 0 260 170" className={cn("w-full", className)} aria-hidden preserveAspectRatio="xMidYMax slice">
      <defs>
        <pattern id="flute" width="12" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 5 Q3 0 6 5 T12 5" fill="none" stroke="#7a4d22" strokeWidth="1.6" />
        </pattern>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e2331" stopOpacity="1" />
          <stop offset=".45" stopColor="#1e2331" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="roll" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#3b2a1a" />
          <stop offset=".18" stopColor="#3b2a1a" />
          <stop offset=".2" stopColor="#c99459" />
          <stop offset="1" stopColor="#a8723c" />
        </radialGradient>
      </defs>
      {sheets.map((_, i) => {
        const y = 60 + i * 15;
        return (
          <g key={i} transform={`translate(${-10 + i * 3} 0)`}>
            <rect x="0" y={y} width="170" height="14" fill={i % 2 ? "#c99257" : "#d6a167"} />
            <rect x="0" y={y + 3} width="170" height="8" fill="url(#flute)" opacity=".85" />
            <rect x="0" y={y} width="170" height="2" fill="#e8bd86" />
          </g>
        );
      })}
      <circle cx="225" cy="140" r="60" fill="url(#roll)" />
      {[48, 40, 32, 24].map((r) => (
        <circle key={r} cx="225" cy="140" r={r} fill="none" stroke="#8f5e2c" strokeOpacity=".35" />
      ))}
      <rect width="260" height="170" fill="url(#fade)" />
    </svg>
  );
}
