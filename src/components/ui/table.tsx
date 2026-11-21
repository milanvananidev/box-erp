import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm tabular", className)} {...props} />
    </div>
  );
}
export const TableHeader = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("bg-subtle [&_tr]:border-b [&_tr]:border-border", className)} {...p} />
);
export const TableBody = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...p} />
);
export const TableRow = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("border-b border-border/70 transition-colors hover:bg-subtle/70 data-[state=selected]:bg-brand-50", className)} {...p} />
);
export const TableHead = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn("h-10 px-4 text-left align-middle text-[13px] font-medium whitespace-nowrap text-[#475467] first:pl-5 last:pr-5", className)}
    {...p}
  />
);
export const TableCell = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("h-12 px-4 align-middle whitespace-nowrap text-foreground first:pl-5 last:pr-5", className)} {...p} />
);
