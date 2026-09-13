/**
 * Turning files a person picked or dropped into what `importReports` accepts,
 * and summarising what came back. Files that can't be reports are answered here,
 * without a round trip, so every file still gets exactly one outcome.
 *
 * No Vue or browser-only APIs beyond File, so Deno tests can cover it.
 */
import type { ImportFile, ImportOutcome } from "../../../desktop/contract.ts";

/** Merged reports are tens of kilobytes; anything this large is not one. */
export const MAX_REPORT_BYTES = 20 * 1024 * 1024;

/** A file ready to send, or an outcome decided without sending it. */
export type PreparedFile = ImportFile | ImportOutcome;

const isReadable = (item: PreparedFile): item is ImportFile => "text" in item;

export async function prepareImport(
  files: readonly File[],
  { maxBytes = MAX_REPORT_BYTES } = {},
): Promise<PreparedFile[]> {
  return await Promise.all(files.map(async (file): Promise<PreparedFile> => {
    if (!/\.json$/i.test(file.name)) {
      return {
        fileName: file.name,
        status: "rejected",
        error: `${file.name}: only .json report files can be imported`,
      };
    }
    if (file.size > maxBytes) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return {
        fileName: file.name,
        status: "rejected",
        error: `${file.name} is ${mb} MB — too large to be a report`,
      };
    }
    return { name: file.name, text: await file.text() };
  }));
}

/** The files to send to `importReports`, in the order they were picked. */
export function filesToSend(prepared: readonly PreparedFile[]): ImportFile[] {
  return prepared.filter(isReadable);
}

/** Puts the bindings' outcomes back in place, so outcomes follow the picked order. */
export function mergeOutcomes(
  prepared: readonly PreparedFile[],
  sent: readonly ImportOutcome[],
): ImportOutcome[] {
  let next = 0;
  return prepared.map((item) => isReadable(item) ? sent[next++] : item);
}

export type ImportSummary = {
  added: number;
  duplicates: number;
  rejected: number;
  warnings: number;
};

export function summarizeImport(
  outcomes: readonly ImportOutcome[],
): ImportSummary {
  const summary = { added: 0, duplicates: 0, rejected: 0, warnings: 0 };
  for (const outcome of outcomes) {
    if (outcome.status === "added") summary.added++;
    else if (outcome.status === "duplicate") summary.duplicates++;
    else summary.rejected++;
    if (outcome.status !== "rejected") {
      summary.warnings += outcome.warnings.length;
    }
  }
  return summary;
}

/** "2 added · 1 already imported · 1 couldn't be imported" */
export function describeImport(summary: ImportSummary): string {
  const parts = [
    summary.added && `${summary.added} added`,
    summary.duplicates && `${summary.duplicates} already imported`,
    summary.rejected && `${summary.rejected} couldn't be imported`,
  ].filter(Boolean);
  return parts.join(" · ") || "No files";
}
