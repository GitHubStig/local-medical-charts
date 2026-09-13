/**
 * Checks on an uploaded file before it is imported, and warnings about how it
 * was filed. Shared by the SQLite store and the browser-dev fake bindings, so
 * both explain problems in the same words. No Zod here: full schema validation
 * happens in the store, on top of these checks.
 */
import { SCHEMA_VERSION } from "../src/version.ts";

/**
 * Why a parsed upload clearly isn't an importable report, in words a person can
 * act on — or null when it looks like one.
 */
export function uploadProblem(json: unknown): string | null {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return "not a report: expected a JSON object";
  }
  const file = json as Record<string, unknown>;

  if ("extraction" in file && "promptHash" in file && !("tests" in file)) {
    return "this is a single OCR page file (*.page.json), not a report — import the merged report file instead";
  }
  if ("suggestions" in file && "instructions" in file) {
    return "this is an analyte suggestions file from `deno task map`, not a report";
  }
  if (!("schemaVersion" in file)) {
    return "not a merged report from the OCR pipeline (it has no schemaVersion)";
  }

  const version = file.schemaVersion;
  if (
    typeof version !== "number" || !Number.isInteger(version) || version < 1
  ) {
    return `not a merged report: invalid schemaVersion ${
      JSON.stringify(version)
    }`;
  }
  if (version > SCHEMA_VERSION) {
    return `made by a newer version of the app (report format ${version}; this app reads up to ${SCHEMA_VERSION}) — update the app`;
  }
  if (!Array.isArray(file.pages)) {
    return "not a merged report: it has no embedded pages to build results from";
  }
  return null;
}

export type PatientDetails = {
  name: string | null;
  /** ISO date. */
  dateOfBirth: string | null;
};

/** Names compared by letters only, so case, spacing and hyphens don't matter. */
export function comparableName(name: string | null): string | null {
  const letters = name?.toUpperCase().replace(/[^\p{L}]+/gu, " ").trim();
  return letters || null;
}

/**
 * A report was filed under an existing patient because the ID number matched.
 * Warn when the name or date of birth disagree — usually an ID misread by OCR,
 * occasionally two people sharing a mistyped ID.
 */
export function idMatchWarnings(
  existing: PatientDetails,
  incoming: PatientDetails,
): string[] {
  const warnings: string[] = [];
  const existingName = comparableName(existing.name);
  const incomingName = comparableName(incoming.name);
  const who = existing.name ?? "an existing patient";

  if (existingName && incomingName && existingName !== incomingName) {
    warnings.push(
      `The ID number matches ${who}, but this report names ${incoming.name}. It was filed under ${who} — check the ID was read correctly.`,
    );
  }
  if (
    existing.dateOfBirth && incoming.dateOfBirth &&
    existing.dateOfBirth !== incoming.dateOfBirth
  ) {
    warnings.push(
      `The ID number matches ${who}, but the date of birth differs (${existing.dateOfBirth} on file, ${incoming.dateOfBirth} in this report).`,
    );
  }
  return warnings;
}

/**
 * A report started a new patient, but someone with the same name and date of
 * birth is already filed under a different ID number.
 */
export function sameNameDifferentIdWarning(name: string | null): string {
  return `Another patient named ${
    name ?? "the same"
  } with the same date of birth is filed under a different ID number. If they are the same person, an ID may have been read incorrectly.`;
}

/** True when two patients have the same comparable name and date of birth. */
export function sameNameAndBirthDate(
  a: PatientDetails,
  b: PatientDetails,
): boolean {
  const name = comparableName(a.name);
  return !!name && !!a.dateOfBirth && name === comparableName(b.name) &&
    a.dateOfBirth === b.dateOfBirth;
}
