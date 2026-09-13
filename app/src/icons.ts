/**
 * The icon SVGs as strings, keyed by name. Vite inlines every file in
 * assets/icons into the bundle at build time — no requests, cached with the app.
 */
import type { IconName } from "./icon-names.ts";

const files = import.meta.glob<string>("./assets/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const ICONS = Object.fromEntries(
  Object.entries(files).map((
    [path, svg],
  ) => [path.slice(path.lastIndexOf("/") + 1, -".svg".length), svg]),
) as Record<IconName, string>;
