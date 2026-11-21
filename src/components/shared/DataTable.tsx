import { useEffect, useState } from "react";
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type CellData,
  type TableFeatures,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Kbd } from "@/components/ui/kbd";
import { EmptyState, ErrorState } from "./states";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  interface ColumnMeta<in out TFeatures extends TableFeatures, in out TData extends RowData, TValue extends CellData = CellData> {
    align?: "left" | "right" | "center";
    /** Extra class for both header and body cells */
    className?: string;
    /** phantom use so the generic params are referenced */
    _?: [TFeatures, TData, TValue];
  }
}

/** Stable, module-level feature set shared by every list screen. */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;
export type DataColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>;

const PAGE_SIZES = [10, 25, 50, 100];

export interface DataTableProps<TData extends RowData> {
  columns: DataColumn<TData>[];
  data: TData[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  searchPlaceholder?: string;
  /** Extra filter controls rendered next to the search box */
  toolbar?: React.ReactNode;
  /** Right side of the toolbar (export, add…) */
  actions?: React.ReactNode;
  empty?: { title: string; description?: string; action?: React.ReactNode };
  initialSort?: { id: string; desc: boolean }[];
  pageSize?: number;
  getRowId?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  /** Rendered under the table, e.g. totals for the filtered rows */
  footer?: (filteredRows: TData[]) => React.ReactNode;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  searchPlaceholder = "Search…",
  toolbar,
  actions,
  empty,
  initialSort = [],
  pageSize = 25,
  getRowId,
  onRowClick,
  footer,
}: DataTableProps<TData>) {
  const [fallback] = useState<TData[]>([]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? fallback,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    globalFilterFn: "includesString",
    initialState: { sorting: initialSort, pagination: { pageIndex: 0, pageSize } },
  });

  const [search, setSearch] = useState("");
  // debounce search so large lists stay responsive
  useEffect(() => {
    const t = setTimeout(() => table.setGlobalFilter(search), 150);
    return () => clearTimeout(t);
  }, [search, table]);

  const inputId = "datatable-search";
  useHotkeys({ "/": () => document.getElementById(inputId)?.focus() });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getPrePaginatedRowModel().rows.length;
  const { pageIndex, pageSize: size } = table.atoms.pagination.get();
  const from = filteredCount === 0 ? 0 : pageIndex * size + 1;
  const to = Math.min(filteredCount, (pageIndex + 1) * size);
  const colCount = columns.length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={inputId}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearch("")}
            placeholder={searchPlaceholder}
            className="pr-14 pl-9"
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : (
            <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
          )}
        </div>
        {toolbar}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>

      {/* Table */}
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(meta?.align === "right" && "text-right", meta?.align === "center" && "text-center", meta?.className)}
                      aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            meta?.align === "right" && "flex-row-reverse",
                            sorted && "text-foreground",
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && !data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {Array.from({ length: colCount }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-36" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount}>
                  {search ? (
                    <EmptyState
                      compact
                      icon={Search}
                      title="No matching records"
                      description={`Nothing matches “${search}”. Try a different term or clear filters.`}
                      action={<Button variant="outline" size="sm" onClick={() => setSearch("")}>Clear search</Button>}
                    />
                  ) : (
                    <EmptyState compact title={empty?.title ?? "No records yet"} description={empty?.description} action={empty?.action} />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(meta?.align === "right" && "text-right", meta?.align === "center" && "text-center", meta?.className)}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {footer && !error && data && footer(table.getPrePaginatedRowModel().rows.map((r) => r.original))}

      {/* Pagination */}
      {!error && (
        <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span className="tabular">
            {filteredCount > 0 ? (
              <>
                Showing <span className="font-medium text-foreground">{from}–{to}</span> of{" "}
                <span className="font-medium text-foreground">{filteredCount}</span>
              </>
            ) : (
              "No rows"
            )}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <Select value={String(size)} onValueChange={(v) => table.setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="tabular">
              Page {table.getPageCount() === 0 ? 0 : pageIndex + 1} of {table.getPageCount()}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
