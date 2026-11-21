import { cn } from "@/lib/utils";

export interface RCol<T> {
  header: string;
  align?: "right" | "left";
  cell: (row: T) => React.ReactNode;
  /** Plain value for CSV; defaults to the cell when it's a string/number */
  csv?: (row: T) => unknown;
  /** Footer total cell */
  total?: React.ReactNode;
  totalCsv?: unknown;
  className?: string;
}

/** Static report table with optional totals row. Prints cleanly (no sticky / interactive bits). */
export function ReportTable<T>({
  columns, rows, rowKey, totalLabel = "Total", emptyText = "No data for this period", dense,
}: { columns: RCol<T>[]; rows: T[]; rowKey: (r: T, i: number) => string; totalLabel?: string; emptyText?: string; dense?: boolean }) {
  const hasTotals = columns.some((c) => c.total !== undefined);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="border-b border-border bg-subtle text-[13px] text-[#475467]">
            {columns.map((c, i) => (
              <th key={i} className={cn("h-9 px-4 font-medium whitespace-nowrap first:pl-5 last:pr-5", c.align === "right" ? "text-right" : "text-left", c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-muted-foreground">{emptyText}</td></tr>
          ) : (
            rows.map((r, ri) => (
              <tr key={rowKey(r, ri)} className="border-b border-border/70 last:border-0">
                {columns.map((c, i) => (
                  <td key={i} className={cn("px-4 whitespace-nowrap first:pl-5 last:pr-5", dense ? "h-9" : "h-11", c.align === "right" && "text-right", c.className)}>{c.cell(r)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {hasTotals && rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border bg-subtle font-semibold">
              {columns.map((c, i) => (
                <td key={i} className={cn("h-10 px-4 whitespace-nowrap first:pl-5 last:pr-5", c.align === "right" && "text-right", c.className)}>
                  {i === 0 && c.total === undefined ? totalLabel : c.total}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Rows for downloadCsv from table columns. */
export function tableToCsv<T>(columns: RCol<T>[], rows: T[]): { header: string[]; rows: unknown[][] } {
  const val = (c: RCol<T>, r: T) => {
    if (c.csv) return c.csv(r);
    const v = c.cell(r);
    return typeof v === "string" || typeof v === "number" ? v : "";
  };
  const out = rows.map((r) => columns.map((c) => val(c, r)));
  if (columns.some((c) => c.totalCsv !== undefined)) out.push(columns.map((c, i) => (c.totalCsv !== undefined ? c.totalCsv : i === 0 ? "Total" : "")));
  return { header: columns.map((c) => c.header), rows: out };
}
