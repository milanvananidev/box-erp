import { useEffect } from "react";
import { create } from "zustand";

interface PageMeta {
  title: string;
  subtitle?: string;
}

export const usePageMetaStore = create<PageMeta & { set: (m: PageMeta) => void }>((set) => ({
  title: "",
  subtitle: undefined,
  set: (m) => set(m),
}));

/** Pages declare their title here; the top bar renders it. Also sets the window title. */
export function usePageMeta(title: string, subtitle?: string) {
  const set = usePageMetaStore((s) => s.set);
  useEffect(() => {
    set({ title, subtitle });
    document.title = `${title} · BoxERP`;
  }, [title, subtitle, set]);
}
