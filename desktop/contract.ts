/**
 * The bindings the desktop window exposes to the page.
 *
 * This one type is the contract between the two sides:
 *   - desktop/main.ts passes it to `new Deno.BrowserWindow<DesktopBindings>()`,
 *     so every `win.bind()` is checked against it (name, arguments, result);
 *   - the Vue app types `globalThis.bindings` with it, and its browser-dev fake
 *     implements it too.
 *
 * Arguments and results cross the boundary as JSON: plain objects, arrays,
 * strings, numbers, booleans and null — no undefined, Date, Map or class
 * instances. A Uint8Array crosses intact as an argument of its own or in a
 * result, but not nested inside an argument object, where it arrives as a plain
 * object. Every binding returns a Promise on both sides.
 */
import type { ReportWithoutPages } from "./report-data.ts";
import type { ChartLibrary, Settings, Theme } from "./settings.ts";
import type {
  FiledReport,
  ImportFileInfo,
  ImportFiling,
  ImportJob,
  ImportPage,
  ImportStart,
  ImportStatus,
  OcrCheck,
  OcrModel,
  OcrModelList,
  OcrTest,
  PatientSummary,
  ReportSummary,
  StoredResult,
  UpgradeSummary,
} from "./types.ts";

export type {
  ChartLibrary,
  FiledReport,
  ImportFileInfo,
  ImportFiling,
  ImportJob,
  ImportPage,
  ImportStart,
  ImportStatus,
  OcrCheck,
  OcrModel,
  OcrModelList,
  OcrTest,
  PatientSummary,
  ReportSummary,
  ReportWithoutPages,
  Settings,
  StoredResult,
  Theme,
  UpgradeSummary,
};

export type StartupStatus =
  | {
    ok: true;
    databasePath: string;
    schemaVersion: number;
    catalogHash: string;
    /** What the launch-time upgrade of stored reports did. */
    upgrade: UpgradeSummary;
  }
  | { ok: false; databasePath: string; error: string };

export type DashboardReport = ReportSummary & {
  /** The upgraded report, or null when its latest upgrade failed. */
  report: ReportWithoutPages | null;
};

export type Dashboard = {
  patient: PatientSummary;
  /** Newest first. */
  reports: DashboardReport[];
  /** From reports in good standing only. */
  results: StoredResult[];
};

export type ImportFile = { name: string; text: string };

export type ImportOutcome =
  | {
    fileName: string;
    status: "added" | "duplicate";
    patientId: number;
    reportId: number;
    /** e.g. the ID number matched a patient with a different name. */
    warnings: string[];
    summary: FiledReport;
  }
  | { fileName: string; status: "rejected"; error: string };

/** A read import, for a person to check before it's saved. */
export type ImportReview = {
  job: ImportJob;
  report: ReportWithoutPages;
  filing: ImportFiling;
};

export type DesktopBindings = {
  /** Whether the database opened, and what the launch upgrade changed. */
  getStartupStatus(): Promise<StartupStatus>;
  listPatients(): Promise<PatientSummary[]>;
  /** Everything the dashboard shows for one patient, or null if there's no such patient. */
  getDashboard(patientId: number): Promise<Dashboard | null>;
  /** Adds report files; each gets its own outcome, so one bad file doesn't stop the rest. */
  importReports(files: ImportFile[]): Promise<ImportOutcome[]>;
  deleteReport(reportId: number): Promise<boolean>;
  /** Removes all patients and reports. Settings are kept. */
  clearAll(): Promise<void>;
  getSettings(): Promise<Settings>;
  /** Saves the given settings and returns all of them. Invalid values reject. */
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  /** Models installed at the saved Ollama address, and which of them can read images. */
  listOcrModels(): Promise<OcrModelList>;
  /**
   * Tests the saved Ollama address and model: reachable, installed, reads a test
   * image. Can take a minute or more while Ollama loads a large model.
   */
  testOcr(): Promise<OcrTest>;
  /**
   * Starts reading one report, a PDF or photos of its pages in order, with the
   * saved model. `bytes` holds every file's bytes back to back, in the order and
   * sizes `files` lists (see desktop/imports/packed-files.ts). Reading carries on
   * in the background, one import at a time: poll listImports to follow it.
   */
  startImport(files: ImportFileInfo[], bytes: Uint8Array): Promise<ImportStart>;
  /** Imports in the order added, until each is saved or discarded. */
  listImports(): Promise<ImportJob[]>;
  /** Stops a waiting or reading import, keeping pages already read. Null if there's no such import. */
  cancelImport(importId: number): Promise<ImportJob | null>;
  /** Queues a failed or cancelled import again; it carries on after the pages already read. */
  retryImport(importId: number): Promise<ImportJob | null>;
  /** Forgets an import and its files, stopping it first if it's reading. */
  discardImport(importId: number): Promise<boolean>;
  /** A ready import's merged report, for review. Null unless the import is ready. */
  getImportReview(importId: number): Promise<ImportReview | null>;
  /** One page image of an import, numbered from 1. */
  getImportPage(importId: number, page: number): Promise<ImportPage | null>;
  /** Saves a ready import as a report, then forgets its files. Rejects unless it's ready. */
  saveImport(importId: number): Promise<ImportOutcome>;
};
