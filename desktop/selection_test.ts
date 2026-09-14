import { assertEquals } from "@std/assert";
import { importedPatient, resolveSelection } from "../app/src/lib/selection.ts";
import type { ImportOutcome, PatientSummary } from "./contract.ts";

/** How the tests' made-up outcomes describe their report: nothing to say. */
const FILED = {
  patientName: null,
  collectedAt: null,
  providerName: null,
  resultCount: 0,
};

// Synthetic patients only.

const patient = (
  id: number,
  lastCollectedAt: string | null,
): PatientSummary => ({
  id,
  name: `PATIENT ${id}`,
  idNumber: null,
  dateOfBirth: null,
  sex: null,
  reportCount: 1,
  failedReportCount: 0,
  firstCollectedAt: lastCollectedAt,
  lastCollectedAt,
});

const patients = [
  patient(1, "2025-01-14T08:30:00"),
  patient(2, "2026-03-18T08:40:00"),
  patient(3, null),
];

Deno.test("the remembered patient is kept while they exist", () => {
  assertEquals(resolveSelection(patients, 1), 1);
  assertEquals(resolveSelection(patients, 3), 3);
});

Deno.test("otherwise the patient with the most recent report is chosen", () => {
  assertEquals(resolveSelection(patients, null), 2);
  assertEquals(resolveSelection(patients, 99), 2);
  assertEquals(resolveSelection([patient(5, null), patient(4, null)], null), 4);
  assertEquals(resolveSelection([], 1), null);
});

Deno.test("an import that added one patient's reports selects that patient", () => {
  const added = (patientId: number): ImportOutcome => ({
    fileName: `${patientId}.json`,
    status: "added",
    patientId,
    reportId: patientId * 10,
    summary: FILED,
    warnings: [],
  });
  assertEquals(importedPatient([added(2), added(2)]), 2);
  assertEquals(importedPatient([added(2), added(3)]), null);
  assertEquals(
    importedPatient([{
      fileName: "x",
      status: "duplicate",
      patientId: 2,
      reportId: 1,
      summary: FILED,
      warnings: [],
    }]),
    null,
  );
  assertEquals(
    importedPatient([{ fileName: "x", status: "rejected", error: "no" }]),
    null,
  );
});
