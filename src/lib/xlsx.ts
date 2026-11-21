import { command } from "@/lib/ipc";
import { format } from "date-fns";
import { downloadCsv } from "@/lib/csv";

export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

export interface XlsxExportInput {
  title?: string;
  sheets: XlsxSheet[];
}

/**
 * Native .xlsx export using rust_xlsxwriter via Tauri command `export_xlsx`.
 * Generates an Excel workbook and triggers download.
 * Falls back to CSV export in browser mock preview.
 */
export async function downloadXlsx(filePrefix: string, sheets: XlsxSheet[], title?: string) {
  const fileName = `${filePrefix}-${format(new Date(), "yyyyMMdd")}`;

  try {
    const bytes = await command<number[] | Uint8Array>("export_xlsx", { input: { title, sheets } }, () => []);

    if (bytes && (bytes instanceof Uint8Array ? bytes.length > 0 : bytes.length > 0)) {
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const blob = new Blob([uint8.buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
  } catch (err) {
    console.warn("Native xlsx export failed, falling back to CSV:", err);
  }

  // Fallback to CSV for web preview
  if (sheets.length > 0) {
    const s = sheets[0];
    downloadCsv(filePrefix, s.headers, s.rows);
  }
}
