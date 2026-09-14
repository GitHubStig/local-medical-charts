/**
 * The screens reachable by address. The #fragment picks one, so the webview's
 * back and reload work without a router.
 */
export type Route =
  | { name: "home" }
  | { name: "settings" }
  | { name: "review"; importId: number };

/** "#/settings" is Settings, "#/review/3" reviews import 3, anything else is the home screen. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  if (path === "settings") return { name: "settings" };
  const review = path.match(/^review\/([1-9]\d*)$/);
  if (review) return { name: "review", importId: Number(review[1]) };
  return { name: "home" };
}
