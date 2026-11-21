import { useQuery } from "@tanstack/react-query";
import { command } from "@/lib/ipc";
import { materials } from "@/data/mock/seed";
import { formatQty } from "@/lib/format";

export interface Alert {
  id: string;
  kind: "low_stock" | "salary_pending" | "reorder";
  title: string;
  detail: string;
  href: string;
}

function mockAlerts(): Alert[] {
  return [
    ...materials
      .filter((m) => m.stock <= m.reorderLevel)
      .map<Alert>((m) => ({
        id: `ls-${m.id}`,
        kind: "low_stock",
        title: `Low stock: ${m.name}`,
        detail: `${formatQty(m.stock, m.unit)} left · reorder at ${formatQty(m.reorderLevel, m.unit)}`,
        href: `/inventory?material=${m.id}`,
      })),
  ];
}

export const useAlerts = () =>
  useQuery({ queryKey: ["alerts"], queryFn: () => command("alerts_list", undefined, mockAlerts), refetchInterval: 5 * 60_000 });
