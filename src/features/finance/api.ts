import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { command } from "@/lib/ipc";
import { categories, parties, transactions } from "@/data/mock/seed";
import type { Direction, PaymentMode, Transaction } from "@/types/domain";

export interface TransactionInput {
  date: string;
  direction: Direction;
  amount: number; // paise
  category: string;
  mode: PaymentMode;
  partyId?: string;
  particulars: string;
  reference?: string;
}

/* ── mock "database" mutations (in-memory, reset on reload) ── */
let seq = 10_000;
function mockCreate(input: TransactionInput): Transaction {
  const cat = categories.find((c) => c.name === input.category);
  const party = parties.find((p) => p.id === input.partyId);
  const t: Transaction = {
    ...input,
    id: `t${seq++}`,
    treatment: cat?.treatment ?? "operating",
    partyName: party?.name,
    source: "manual",
    createdAt: new Date().toISOString(),
  };
  transactions.unshift(t);
  transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return t;
}
export const ORIGIN_PLACE = { advance: "Workers & HR → Advances", payroll: "Payroll", inventory: "Inventory (the inward entry)" } as const;

function mockDelete(id: string) {
  const i = transactions.findIndex((t) => t.id === id);
  if (i === -1) throw { kind: "NotFound", message: "Transaction no longer exists" };
  const o = transactions[i]!.origin;
  if (o) throw { kind: "Conflict", message: `This entry was created automatically. Change it from ${ORIGIN_PLACE[o.module]}.` };
  if (transactions[i]!.source === "vyapar_import")
    throw { kind: "Validation", message: "Imported Vyapar entries can't be deleted here. Correct them in Vyapar and re-import." };
  transactions.splice(i, 1);
  return id;
}

/**
 * Possible duplicates: same direction & amount, same party (if given), within ±3 days.
 * Used to warn before saving a manual entry that Vyapar has probably already imported.
 */
function mockSimilar(input: Pick<TransactionInput, "date" | "direction" | "amount" | "partyId">) {
  if (!input.amount || !input.date) return [];
  return transactions
    .filter(
      (t) =>
        t.direction === input.direction &&
        t.amount === input.amount &&
        (!input.partyId || t.partyId === input.partyId) &&
        Math.abs(differenceInCalendarDays(parseISO(t.date), parseISO(input.date))) <= 3,
    )
    .slice(0, 3);
}

export const financeKeys = {
  all: ["transactions"] as const,
  list: () => [...financeKeys.all, "list"] as const,
  similar: (i: unknown) => [...financeKeys.all, "similar", i] as const,
};

export const useTransactions = () =>
  useQuery({ queryKey: financeKeys.list(), queryFn: () => command("transactions_list", undefined, () => transactions) });

export const useSimilarTransactions = (input: Parameters<typeof mockSimilar>[0], enabled: boolean) =>
  useQuery({
    queryKey: financeKeys.similar(input),
    queryFn: () => command("transactions_find_similar", { input }, () => mockSimilar(input)),
    enabled: enabled && input.amount > 0,
    staleTime: 10_000,
  });

export const useParties = () => useQuery({ queryKey: ["parties"], queryFn: () => command("parties_list", undefined, () => parties), staleTime: Infinity });
export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => command("categories_list", undefined, () => categories), staleTime: Infinity });

function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: financeKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);
}

export function useCreateTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (input: TransactionInput) => command("transactions_create", { input }, () => mockCreate(input)),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (id: string) => command("transactions_delete", { id }, () => mockDelete(id)),
    onSuccess: invalidate,
  });
}
