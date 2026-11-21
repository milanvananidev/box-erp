import { format } from "date-fns";

/**
 * Download rows as a UTF-8 CSV (with BOM so Excel shows ₹ and Indian names correctly).
 * Native .xlsx export will move to the Rust layer with a save dialog.
 */
export function downloadCsv(filePrefix: string, header: string[], rows: unknown[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = (header.length ? [header, ...rows] : rows).map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `${filePrefix}-${format(new Date(), "yyyyMMdd")}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}
