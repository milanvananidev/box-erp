import { dataSource } from "./env";
import { sleep } from "./utils";

/** Shape of errors serialised by the Rust layer (see src-tauri/src/error.rs). */
export interface CommandError {
  kind: "NotConfigured" | "Connection" | "Database" | "Validation" | "NotFound" | "Conflict" | "Internal";
  message: string;
}

export class AppError extends Error {
  kind: CommandError["kind"];
  constructor(e: CommandError) {
    super(e.message);
    this.kind = e.kind;
  }
}

function normalise(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err && typeof err === "object" && "kind" in err && "message" in err) return new AppError(err as CommandError);
  return new AppError({ kind: "Internal", message: typeof err === "string" ? err : "Unexpected error" });
}

/**
 * Single entry point for every backend call.
 *
 * The React app never talks to MongoDB. It invokes a named Tauri command; the
 * Rust side owns the connection, credentials and queries. While the UI is in
 * review each call also carries a `mock` implementation so screens can be
 * built and exercised in a plain browser (`pnpm dev`).
 */
export async function command<T>(
  name: string,
  args: Record<string, unknown> | undefined,
  mock: () => T | Promise<T>,
): Promise<T> {
  try {
    if (dataSource === "tauri") {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(name, args);
    }
    await sleep(200 + Math.random() * 300); // make loading states visible during review
    return structuredClone(await mock());
  } catch (e) {
    throw normalise(e);
  }
}
