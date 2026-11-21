import { useCompanySettings } from "@/features/settings/api";

/**
 * Company details printed on salary slips and reports.
 * Defaults fall back to placeholder if not yet loaded.
 */
export const COMPANY = {
  name: "Gujarat Corrugated Box Industry",
  address: "Plot 42, GIDC Industrial Estate, Rajkot, Gujarat 360001",
  phone: "+91 98765 43210",
  gstin: "24AABCB1234D1Z2",
};

export function useCompany() {
  const { data } = useCompanySettings();
  return {
    name: data?.name || COMPANY.name,
    address: data?.address || COMPANY.address,
    phone: data?.phone || COMPANY.phone,
    gstin: data?.gstin || COMPANY.gstin,
    wastageTargetPct: data?.wastageTargetPct ?? 3.0,
    weeklyOff: data?.weeklyOff || "Sunday",
    openingCashBalance: data?.openingCashBalance ?? 0,
    openingBankBalance: data?.openingBankBalance ?? 0,
    openingDate: data?.openingDate || "2026-04-01",
  };
}
