/** How each result flag reads on a FlagPill. */
export const FLAGS = {
  H: { label: "High", kind: "high" },
  L: { label: "Low", kind: "low" },
  A: { label: "Abnormal", kind: "abnormal" },
} as const;

export type Flag = keyof typeof FLAGS;

/** The stored flag as a known Flag, or null for none (or one we don't recognise). */
export function toFlag(flag: string | null): Flag | null {
  return flag !== null && flag in FLAGS ? flag as Flag : null;
}
