import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { command } from "@/lib/ipc";
import { materials, productionOrders, TODAY } from "@/data/mock/seed";
import { formatDate, formatQty } from "@/lib/format";

export interface Alert {
  id: string;
  kind: "low_stock" | "order_due";
  title: string;
  detail: string;
  href: string;
}

function mockAlerts(): Alert[] {
  const soon = format(addDays(TODAY, 1), "yyyy-MM-dd");
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
    ...productionOrders
      .filter((o) => o.stage !== "completed" && o.dueDate <= soon)
      .map<Alert>((o) => ({
        id: `due-${o.id}`,
        kind: "order_due",
        title: `${o.orderNo} due ${formatDate(o.dueDate)}`,
        detail: `${o.customer} · ${formatQty(o.producedQty)} / ${formatQty(o.plannedQty)} pcs`,
        href: `/production?order=${o.id}`,
      })),
  ];
}

export const useAlerts = () =>
  useQuery({ queryKey: ["alerts"], queryFn: () => command("alerts_list", undefined, mockAlerts), refetchInterval: 5 * 60_000 });
