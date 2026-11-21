import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/env";
import { AppError, command } from "@/lib/ipc";

export interface DbStatus {
  configured: boolean;
  connected: boolean;
  /** Host(s) only — the Rust side never returns credentials */
  host?: string;
  database?: string;
  source?: "keychain" | "env";
  error?: string;
}

/**
 * Connection management always talks to Rust (no mock): in a plain browser
 * there is no backend, so we report that instead of pretending.
 */
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new AppError({ kind: "NotConfigured", message: "Database settings are only available in the desktop app." });
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw e && typeof e === "object" && "message" in e ? new AppError(e as never) : new AppError({ kind: "Internal", message: String(e) });
  }
}

export const useDbStatus = () =>
  useQuery({ queryKey: ["db-status"], queryFn: () => call<DbStatus>("db_status"), retry: false, enabled: isTauri(), refetchInterval: 60_000 });

export function useConfigureDb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { uri: string; database: string }) => call<DbStatus>("db_configure", v),
    onSuccess: (s) => qc.setQueryData(["db-status"], s),
  });
}

export function useForgetDb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call<DbStatus>("db_forget"),
    onSuccess: (s) => qc.setQueryData(["db-status"], s),
  });
}

/** Debug builds only: copy the UI's demo data into an empty development database. */
export function useImportDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const seed = await import("@/data/mock/seed");
      return call<{ collections: [string, number][] }>("dev_import_demo", {
        payload: {
          parties: seed.parties,
          transactions: seed.transactions,
          workers: seed.workers,
          attendance: seed.attendance,
          advances: seed.advances,
          salaryPayments: seed.salaryPayments,
          productionOrders: seed.productionOrders,
          productionEntries: seed.productionEntries,
          materials: seed.materials,
          stockMovements: seed.stockMovements,
          payrollRuns: seed.payrollRuns,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  wastageTargetPct: number;
  weeklyOff: string;
  openingCashBalance: number;
  openingBankBalance: number;
  openingDate: string;
}

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: "Gujarat Corrugated Box Industry",
  address: "Plot 42, GIDC Industrial Estate, Rajkot, Gujarat 360001",
  phone: "+91 98765 43210",
  gstin: "24AABCB1234D1Z2",
  wastageTargetPct: 3.0,
  weeklyOff: "Sunday",
  openingCashBalance: 0,
  openingBankBalance: 0,
  openingDate: "2026-04-01",
};

let inMemorySettings: CompanySettings = { ...DEFAULT_COMPANY_SETTINGS };

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: () => command<CompanySettings>("company_settings_get", undefined, () => inMemorySettings),
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompanySettings) =>
      command<CompanySettings>("company_settings_update", { input }, () => {
        inMemorySettings = { ...input };
        return inMemorySettings;
      }),
    onSuccess: (data) => {
      qc.setQueryData(["company-settings"], data);
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
  });
}
