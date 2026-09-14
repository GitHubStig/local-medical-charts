/**
 * What closing the window asks when readings would be lost. Imports live only in
 * memory (ADR 0012), so quitting forgets anything not yet saved. No runtime
 * imports.
 */
import type { ImportJob } from "../types.ts";

/** The question to ask before quitting, or null when nothing unsaved would be lost. */
export function quitWarning(jobs: readonly ImportJob[]): string | null {
  const unsaved =
    jobs.filter((job) =>
      job.status === "waiting" || job.status === "reading" ||
      job.status === "ready"
    ).length;
  if (unsaved === 0) return null;
  return unsaved === 1
    ? "Quit Medical Charts? A reading isn't saved yet and will be lost."
    : `Quit Medical Charts? ${unsaved} readings aren't saved yet and will be lost.`;
}
