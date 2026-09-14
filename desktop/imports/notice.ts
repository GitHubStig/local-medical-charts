/**
 * What a system notification says when a reading finishes. Deliberately
 * generic: notifications show on the lock screen and stay in Notification
 * Center, and file names often carry a patient's name, so a notice never
 * includes names, labs, results, the model or the error. No runtime imports.
 */
import type { ImportJob } from "../types.ts";

export type ReadingNotice = {
  title: string;
  body: string;
  /** The same for every notice about one import, so a retry replaces the earlier one. */
  tag: string;
  /** Where clicking it goes: the review screen, or home, where the imports panel is. */
  href: string;
};

/** The notice for an import that just became ready or failed; null for any other state. */
export function readingNotice(job: ImportJob): ReadingNotice | null {
  const tag = `medical-charts-import-${job.id}`;
  if (job.status === "ready") {
    const pages = job.pageCount === 1 ? "1 page" : `${job.pageCount} pages`;
    return {
      title: "Report ready to review",
      body: `${pages} read. Check the results before saving.`,
      tag,
      href: `#/review/${job.id}`,
    };
  }
  if (job.status === "failed") {
    return {
      title: "Couldn't read a report",
      body: "Open Medical Charts to see why and try again.",
      tag,
      href: "#/",
    };
  }
  return null;
}
