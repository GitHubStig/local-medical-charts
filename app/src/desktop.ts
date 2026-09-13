import type { DesktopBindings } from "../../desktop/contract.ts";

/**
 * The desktop bindings, or null when the app runs in a normal browser
 * (`deno task dev`), where there is no Deno side to call.
 */
export const desktop: DesktopBindings | null =
  (globalThis as { bindings?: DesktopBindings }).bindings ?? null;
