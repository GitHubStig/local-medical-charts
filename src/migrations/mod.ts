/**
 * Report format migrations.
 *
 * Every page file and merged report carries `schemaVersion`. When the format
 * changes in a way that breaks previously written JSON:
 *
 *   1. bump SCHEMA_VERSION in src/schema.ts and change the Zod schemas;
 *   2. add `NNN-short-name.ts` in this folder exporting a Migration from the
 *      previous version (e.g. `002-split-reference-text.ts` for 1 → 2);
 *   3. register it in MIGRATIONS below;
 *   4. add a test that upgrades a small synthetic report in the old format.
 *
 * A migration only needs to bring `schemaVersion`, `source.report` and the
 * embedded `pages` up to date. Everything derived from the pages — tests,
 * flags, unit conversions — is rebuilt afterwards by `upgradeReport`.
 *
 * Migrations are pure: JSON in, JSON out, no I/O, no clock.
 */
import { SCHEMA_VERSION } from "../schema.ts";

export type ReportJson = Record<string, unknown>;

export type Migration = {
  from: number;
  to: number;
  /** One line saying what changed, shown when a report is upgraded. */
  description: string;
  up(report: ReportJson): ReportJson;
};

/** Version 1 is the first versioned format, so there is nothing to migrate yet. */
export const MIGRATIONS: readonly Migration[] = [];

export class MigrationError extends Error {
  override name = "MigrationError";
}

export function readVersion(json: unknown): number {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new MigrationError("not a report: expected a JSON object");
  }
  const version = (json as ReportJson).schemaVersion;
  if (version === undefined) {
    throw new MigrationError(
      "no schemaVersion — not a report written by this pipeline",
    );
  }
  if (
    typeof version !== "number" || !Number.isInteger(version) || version < 1
  ) {
    throw new MigrationError(
      `invalid schemaVersion ${JSON.stringify(version)}`,
    );
  }
  return version;
}

/** Runs every migration between the report's version and `target`, in order. */
export function migrate(
  json: unknown,
  options: { migrations?: readonly Migration[]; target?: number } = {},
): { json: ReportJson; from: number; to: number; applied: Migration[] } {
  const migrations = options.migrations ?? MIGRATIONS;
  const target = options.target ?? SCHEMA_VERSION;
  const from = readVersion(json);

  if (from > target) {
    throw new MigrationError(
      `schemaVersion ${from} is newer than this code understands (${target}) — update the app`,
    );
  }

  let current = structuredClone(json) as ReportJson;
  let version = from;
  const applied: Migration[] = [];

  while (version < target) {
    const candidates = migrations.filter((m) => m.from === version);
    if (candidates.length === 0) {
      throw new MigrationError(`no migration from schemaVersion ${version}`);
    }
    if (candidates.length > 1) {
      throw new MigrationError(
        `more than one migration from schemaVersion ${version}`,
      );
    }
    const step = candidates[0];
    if (step.to !== version + 1) {
      throw new MigrationError(
        `migration "${step.description}" goes from ${step.from} to ${step.to}; each step must move one version`,
      );
    }

    current = step.up(current);
    if (readVersion(current) !== step.to) {
      throw new MigrationError(
        `migration "${step.description}" did not set schemaVersion to ${step.to}`,
      );
    }
    version = step.to;
    applied.push(step);
  }

  return { json: current, from, to: version, applied };
}
