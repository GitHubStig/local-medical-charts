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

export type AddReportResult =
  | { status: "added"; reportId: number; patientId: number }
  | { status: "duplicate"; reportId: number; patientId: number };

export type UpgradeSummary = {
  checked: number;
  upgraded: number;
  failed: { reportId: number; fileName: string; error: string }[];
};
