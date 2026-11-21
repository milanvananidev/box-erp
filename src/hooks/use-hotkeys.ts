import { useEffect, useRef } from "react";

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const modKeyLabel = isMac ? "⌘" : "Ctrl";

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Lightweight hotkey hook.
 * Keys are written as "mod+k", "mod+shift+n", "/", "escape".
 * `mod` = ⌘ on macOS, Ctrl elsewhere. Plain (non-mod) keys are ignored while typing.
 */
export function useHotkeys(map: HotkeyMap, enabled = true) {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const parts = [mod && "mod", e.shiftKey && "shift", e.altKey && "alt", e.key.toLowerCase()].filter(Boolean);
      const combo = parts.join("+");
      const handler = ref.current[combo];
      if (!handler) return;
      if (!mod && isTypingTarget(e.target)) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
