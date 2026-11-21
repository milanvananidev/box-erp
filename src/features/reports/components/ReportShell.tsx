import { useState } from "react";
import { format } from "date-fns";
import { Download, Info, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { PrintPortal } from "@/components/shared/PrintPortal";
import { useCompany } from "@/lib/company";
import { downloadXlsx, type XlsxSheet } from "@/lib/xlsx";
import { cn } from "@/lib/utils";
import type { ReportRange } from "../range";

export interface Kpi {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}

export interface Section {
  title: string;
  description?: string;
  table: React.ReactNode;
  csv?: { header: string[]; rows: unknown[][] };
  /** Narrow sections sit two per row on wide screens */
  half?: boolean;
}

/**
 * Common frame for every report: KPI strip, optional chart, table sections,
 * CSV export (all sections in one file) and a print layout.
 */
export function ReportShell({
  id, title, range, kpis, chart, sections, notes, isLoading, error, onRetry,
}: {
  id: string;
  title: string;
  range: ReportRange;
  kpis: Kpi[];
  chart?: React.ReactNode;
  sections: Section[];
  notes?: React.ReactNode;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const company = useCompany();

  const exportExcel = async () => {
    const withCsv = sections.filter((s) => s.csv);
    if (!withCsv.length) return;
    setExporting(true);
    try {
      const sheets: XlsxSheet[] = withCsv.map((s) => ({
        name: s.title,
        headers: s.csv!.header,
        rows: s.csv!.rows as (string | number | boolean | null)[][],
      }));
      await downloadXlsx(`report-${id}-${range.from}_${range.to}`, sheets, `${title} (${range.label})`);
      toast.success(`Exported ${title} to Excel`);
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  };

  if (error) return <Card><ErrorState error={error} onRetry={onRetry} /></Card>;

  const body = (print: boolean) => (
    <>
      <div className={cn("grid gap-4", kpis.length >= 4 ? "grid-cols-4" : kpis.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {kpis.map((k) => (
          <div key={k.label} className={cn("rounded-xl border border-border p-4", print ? "border-black/30" : "bg-card shadow-card")}>
            <div className="text-[13px] text-muted-foreground">{k.label}</div>
            {isLoading ? <Skeleton className="mt-1.5 h-7 w-32" /> : (
              <div className={cn("mt-0.5 text-[22px] leading-tight font-bold tracking-tight tabular", k.tone === "good" && "text-success-foreground", k.tone === "bad" && "text-danger-foreground")}>{k.value}</div>
            )}
            {k.sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{k.sub}</div>}
          </div>
        ))}
      </div>
      {!print && chart && <Card className="p-5">{isLoading ? <Skeleton className="h-[260px]" /> : chart}</Card>}
      <div className="grid grid-cols-2 gap-5">
        {sections.map((s) => (
          <section key={s.title} className={cn("overflow-hidden rounded-xl border border-border", s.half ? "col-span-2 2xl:col-span-1" : "col-span-2", print ? "break-inside-avoid border-black/30" : "bg-card shadow-card")}>
            <div className="px-5 pt-4 pb-3">
              <h3 className="font-semibold">{s.title}</h3>
              {s.description && <p className="text-[13px] text-muted-foreground">{s.description}</p>}
            </div>
            {isLoading ? <div className="space-y-2 px-5 pb-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : s.table}
          </section>
        ))}
      </div>
      {notes && (
        <div className={cn("flex gap-2.5 rounded-xl p-4 text-[13px] text-[#475467]", print ? "border border-black/20" : "bg-subtle")}>
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">{notes}</div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{range.label}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isLoading || exporting} loading={exporting} onClick={exportExcel}><Download /> Export Excel</Button>
          <Button variant="outline" disabled={isLoading} onClick={() => setPrinting(true)}><Printer /> Print</Button>
        </div>
      </div>
      {body(false)}
      {printing && (
        <PrintPortal onDone={() => setPrinting(false)}>
          <div className="flex flex-col gap-4 font-sans text-[12px] text-black">
            <header className="flex items-end justify-between border-b border-black pb-2">
              <div>
                <div className="text-sm font-bold uppercase">{company.name}</div>
                <div className="text-lg font-bold">{title}</div>
                <div>{range.label}</div>
              </div>
              <div className="text-right text-[11px]">Generated {format(new Date(), "dd MMM yyyy, HH:mm")}</div>
            </header>
            {body(true)}
          </div>
        </PrintPortal>
      )}
    </div>
  );
}
