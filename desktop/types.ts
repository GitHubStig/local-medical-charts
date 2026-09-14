/**
 * Plain data shapes shared by the store, the bindings and the page.
 *
 * Type-only imports keep this module safe for the Vue app to import: nothing
 * here pulls in SQLite, the file system or Zod at runtime.
 */
import type { Test } from "../src/schema.ts";

export type PatientSummary = {
  id: number;
  name: string | null;
  idNumber: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  reportCount: number;
  failedReportCount: number;
  firstCollectedAt: string | null;
  lastCollectedAt: string | null;
};

export type ReportSummary = {
  id: number;
  patientId: number;
  fileName: string;
  collectedAt: string | null;
  providerName: string | null;
  status: "ok" | "failed";
  error: string | null;
  schemaVersion: number;
  catalogHash: string;
  importedAt: string;
  upgradedAt: string;
};

/** One result from one report, flattened for charting. */
export type StoredResult = {
  reportId: number;
  position: number;
  analyte: string | null;
  specimen: string | null;
  name: string;
  collectedAt: string | null;
  resultKind: "numeric" | "comparator" | "text";
  value: number | null;
  op: string | null;
  text: string | null;
  unit: string | null;
  standardValue: number | null;
  standardOp: string | null;
  standardUnit: string | null;
  range: Test["range"];
  flag: string | null;
  flagSource: string | null;
  page: number;
};

export type AddReportResult = {
  status: "added" | "duplicate";
  reportId: number;
  patientId: number;
  /** Things worth a second look about how the report was filed. Empty for duplicates. */
  warnings: string[];
  summary: FiledReport;
};

/** A stored report in a few words, for telling someone what they added. */
export type FiledReport = {
  /** As the report prints it. */
  patientName: string | null;
  collectedAt: string | null;
  providerName: string | null;
  resultCount: number;
};

export type UpgradeSummary = {
  checked: number;
  upgraded: number;
  failed: { reportId: number; fileName: string; error: string }[];
};

/** An installed Ollama model, as the settings page lists it. */
export type OcrModel = {
  name: string;
  /** Ollama reports the "vision" capability: only these models can read report pages. */
  readsImages: boolean;
  /** e.g. "27.8B"; null when Ollama doesn't say. */
  parameterSize: string | null;
  contextLength: number | null;
};

export type OcrModelList =
  | { ok: true; host: string; version: string; models: OcrModel[] }
  | { ok: false; host: string; error: string };

export type OcrCheckStep = "reachable" | "installed" | "reads-images";

/** One step of Test connection. Steps after a failed one aren't run. */
export type OcrCheck = { step: OcrCheckStep; ok: boolean; message: string };

/**
 * One file of an upload: a report's single PDF, or one of the photos of its
 * pages. The bytes travel separately (see desktop/imports/packed-files.ts).
 */
export type ImportFileInfo = { name: string; size: number };

/**
 * Where an import is. One import reads at a time; the others wait their turn.
 * Failed and cancelled imports keep the pages already read, for a retry.
 */
export type ImportStatus =
  | "waiting"
  | "reading"
  | "ready"
  | "failed"
  | "cancelled";

/**
 * A PDF or photos being read into a report. Held in memory only: nothing is
 * stored until the report is saved, and the files are gone once it's saved or
 * discarded (or the app quits).
 */
export type ImportJob = {
  id: number;
  fileNames: string[];
  source: "pdf" | "photos";
  pageCount: number;
  /** Pages read so far; while reading, the model is on the page after these. */
  pagesRead: number;
  status: ImportStatus;
  /** The model reading, or that read it; null until reading starts. */
  model: string | null;
  addedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Why reading failed, in words for the person importing. */
  error: string | null;
  /** Results in the merged report, once it's ready. */
  resultCount: number | null;
};

export type ImportStart =
  | { ok: true; job: ImportJob }
  | { ok: false; fileNames: string[]; error: string };

/** Where a read report would be filed, worked out before it's saved. */
export type ImportFiling = {
  /** The patient it would go under; null when it has no ID number, or name and date of birth, to file it by. */
  patient:
    | {
      kind: "existing";
      id: number;
      name: string | null;
      matchedBy: "id-number" | "name-and-birth-date";
    }
    | { kind: "new"; name: string | null }
    | null;
  /** What saving would warn about, e.g. an ID number matching a patient with another name. */
  warnings: string[];
  /** A saved report for the same patient, lab and collection time: most likely this report again. */
  similarReport: { id: number; fileName: string } | null;
};

/** A page image of an import, for showing beside its results. */
export type ImportPage = {
  name: string;
  type: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
  /** A photo, a PDF page that was one scanned image (sent as it is), or a rendered PDF page. */
  origin: "photo" | "scanned" | "rendered";
};

export type OcrTest = {
  host: string;
  model: string | null;
  /** Every step ran and passed. */
  ok: boolean;
  checks: OcrCheck[];
};
