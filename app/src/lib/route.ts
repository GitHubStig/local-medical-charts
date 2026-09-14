/**
 * The screens reachable by address. The #fragment picks one, so the webview's
 * back and reload work without a router.
 */
export type Route = "home" | "settings";

/** "#/settings" (or "#settings") is Settings; anything else is the home screen. */
export function parseRoute(hash: string): Route {
  return hash.replace(/^#\/?/, "") === "settings" ? "settings" : "home";
}
