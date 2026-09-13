/**
 * Which patient the dashboard shows. Plain functions, tested in
 * desktop/selection_test.ts.
 */
import type {
  ImportOutcome,
  PatientSummary,
} from "../../../desktop/contract.ts";

/**
 * The preferred patient if they still exist; otherwise the one with the most
 * recent report (patients without dates last); null when there are none.
 */
export function resolveSelection(
  patients: readonly PatientSummary[],
  preferred: number | null,
): number | null {
  if (preferred !== null && patients.some((p) => p.id === preferred)) {
    return preferred;
  }
  const newest = [...patients].sort((a, b) =>
    (b.lastCollectedAt ?? "").localeCompare(a.lastCollectedAt ?? "") ||
    a.id - b.id
  );
  return newest[0]?.id ?? null;
}

/** The patient an import added reports for, when it was exactly one patient. */
export function importedPatient(
  outcomes: readonly ImportOutcome[],
): number | null {
  const ids = new Set(
    outcomes.flatMap((o) => o.status === "added" ? [o.patientId] : []),
  );
  return ids.size === 1 ? [...ids][0] : null;
}
