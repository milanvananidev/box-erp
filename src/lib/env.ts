/** True when running inside the Tauri webview (as opposed to a plain browser during UI work). */
export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** True when running on macOS. */
export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Data source switch. With VITE_DATA_SOURCE=tauri inside the desktop app,
 * commands listed in `live-commands.ts` hit MongoDB through Rust; the rest
 * keep using in-memory mocks until their module is ported.
 */
export const dataSource: "mock" | "tauri" =
  (import.meta.env.VITE_DATA_SOURCE ?? "tauri") === "tauri" && isTauri() ? "tauri" : "mock";
