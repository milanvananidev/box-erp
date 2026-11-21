import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileInput, Upload, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { command } from "@/lib/ipc";

export interface VyaparImportSummary {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

export function ImportVyaparDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VyaparImportSummary | null>(null);

  const reset = () => {
    setFile(null);
    setCsvContent("");
    setLoading(false);
    setResult(null);
  };

  const handleFileChange = (f: File) => {
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setCsvContent(text);
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      toast.error("Please select a valid CSV file");
      return;
    }

    setLoading(true);
    try {
      const res = await command<VyaparImportSummary>(
        "vyapar_import",
        { csvContent },
        () => ({
          totalRows: 0,
          importedCount: 0,
          skippedCount: 0,
          errorCount: 0,
          errors: [],
        })
      );

      setResult(res);
      await qc.invalidateQueries({ queryKey: ["transactions"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-cash-flow"] });
      await qc.invalidateQueries({ queryKey: ["parties"] });

      if (res.importedCount > 0) {
        toast.success(`Imported ${res.importedCount} transactions`, {
          description: res.skippedCount > 0 ? `${res.skippedCount} existing entries were skipped` : undefined,
        });
      } else if (res.skippedCount > 0) {
        toast.info("No new transactions to import", {
          description: `All ${res.skippedCount} transactions in this file were already imported earlier.`,
        });
      }
    } catch (e) {
      toast.error("Import failed", {
        description: e instanceof Error ? e.message : "Could not parse or import the CSV file",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <FileInput className="size-5" />
            </span>
            <div>
              <DialogTitle>Import Vyapar Transactions</DialogTitle>
              <DialogDescription>
                Upload a Vyapar Daybook, Sales, or Purchases CSV export.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileChange(f);
              }}
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileChange(f);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center transition hover:border-brand-500 hover:bg-subtle"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-subtle text-muted-foreground">
                  <Upload className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-medium">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground">Vyapar CSV export file (.csv)</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-subtle p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="size-8 text-brand-600" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB · {csvContent.split("\n").filter((l) => l.trim()).length} lines
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setCsvContent("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-subtle p-3.5 text-xs text-[#475467]">
              <p className="font-medium text-foreground">Idempotent Import</p>
              <p className="mt-1">
                Each row is tracked by its Vyapar voucher number. Re-importing the same CSV file will never create duplicate entries.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border bg-subtle p-3">
                <div className="text-xs text-muted-foreground">Imported</div>
                <div className="mt-1 text-2xl font-bold text-success-foreground">
                  {result.importedCount}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-subtle p-3">
                <div className="text-xs text-muted-foreground">Skipped (duplicate)</div>
                <div className="mt-1 text-2xl font-bold text-muted-foreground">
                  {result.skippedCount}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-subtle p-3">
                <div className="text-xs text-muted-foreground">Errors</div>
                <div className="mt-1 text-2xl font-bold text-danger-foreground">
                  {result.errorCount}
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-danger-foreground">
                <p className="font-semibold">Issues encountered:</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!file || loading}
                loading={loading}
                onClick={handleImport}
              >
                Import
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
