/**
 * How the page reaches its data.
 *
 * In the desktop window, the runtime provides `globalThis.bindings`, backed by
 * SQLite. In `deno task dev` (a normal browser) there are no bindings, so a fake
 * with the fictional sample reports stands in. Add `?empty` to the dev URL to
 * start the fake with no reports.
 */
import type { DesktopBindings } from "../../../desktop/contract.ts";

export type ApiMode = "desktop" | "fake";
export type Api = { mode: ApiMode; bindings: DesktopBindings };

export async function connectApi(): Promise<Api> {
  const real = (globalThis as { bindings?: DesktopBindings }).bindings;
  if (real) return { mode: "desktop", bindings: real };

  if (import.meta.env.DEV) {
    // Loaded only in development, so the fake and the samples never ship.
    const [{ createFakeBindings }, { SAMPLE_REPORTS }] = await Promise.all([
      import("./fake-bindings.ts"),
      import("./samples.ts"),
    ]);
    const empty = new URLSearchParams(location.search).has("empty");
    return {
      mode: "fake",
      bindings: createFakeBindings({
        reports: empty ? [] : SAMPLE_REPORTS,
        storage: localStorage,
      }),
    };
  }

  throw new Error(
    "No desktop bindings — open the app with `deno task desktop`.",
  );
}

/**
 * A readable message from anything a binding rejects with. Errors cross the
 * desktop boundary as plain objects, with the error type folded into the message.
 */
export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
