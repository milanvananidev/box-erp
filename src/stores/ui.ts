import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Direction } from "@/types/domain";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  /** Global "new transaction" drawer so quick actions / shortcuts can open it from anywhere. */
  txnSheet: { open: boolean; direction: Direction };
  openTxnSheet: (direction?: Direction) => void;
  closeTxnSheet: () => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),

      txnSheet: { open: false, direction: "out" },
      openTxnSheet: (direction = "out") => set({ txnSheet: { open: true, direction } }),
      closeTxnSheet: () => set((s) => ({ txnSheet: { ...s.txnSheet, open: false } })),
    }),
    { name: "boxerp-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
);
