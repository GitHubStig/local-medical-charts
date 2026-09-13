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
 * strings, numbers, booleans, null and Uint8Array only — no undefined, Date,
 * Map or class instances. Every binding returns a Promise on both sides.
 */
import type { ReportWithoutPages } from "./report-data.ts";
import type { Settings, Theme } from "./settings.ts";
import type {
  PatientSummary,
  ReportSummary,
  StoredResult,
  UpgradeSummary,
} from "./types.ts";

export type {
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
  }
  | { fileName: string; status: "rejected"; error: string };

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
};
