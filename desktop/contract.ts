/**
 * The bindings the desktop window exposes to the page.
 *
 * This one type is the contract between the two sides:
 *   - desktop/main.ts passes it to `new Deno.BrowserWindow<DesktopBindings>()`,
 *     so every `win.bind()` is checked against it (name, arguments, result);
 *   - the Vue app imports it to type `globalThis.bindings`.
 *
 * Arguments and results cross the boundary as JSON: plain objects, arrays,
 * strings, numbers, booleans, null and Uint8Array only. Every binding returns a
 * Promise on both sides.
 */

export type PingReply = {
  message: string;
  deno: string;
  platform: string;
  receivedAt: string;
};

export type DesktopBindings = {
  /** Round-trip check that the page can reach Deno. */
  ping(message: string): Promise<PingReply>;
};
