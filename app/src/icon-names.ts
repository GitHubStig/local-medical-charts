/**
 * Every icon in src/assets/icons, by file name. Listed by hand so a mistyped
 * name is a type error; desktop/icons_test.ts keeps it in step with the folder.
 */
export const ICON_NAMES = [
  "alert-circle",
  "arrow-down",
  "arrow-up",
  "check",
  "chevron-down",
  "chevron-right",
  "close",
  "lock",
  "monitor",
  "moon",
  "plus",
  "search",
  "sun",
  "trash",
  "upload",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
