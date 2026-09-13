/**
 * Brings a stored report up to date with the current code and catalog.
 *
 *   1. migrate its JSON to the current schemaVersion (src/migrations/);
 *   2. re-merge it from its embedded page transcriptions when a migration ran,
 *      the catalog changed since it was merged, the stored report no longer
 *      validates, or a re-merge is forced.
 *
 * Re-merging never calls the model: the pages already hold what was read off
 * the scan. Only a prompt change needs a fresh OCR, and that can't happen here.
 */
import { z } from "@zod/zod";
import type { CatalogIndex } from "./catalog.ts";
import { migrate, type Migration } from "./migrations/mod.ts";
import { buildReport } from "./normalize.ts";
import {
  type Report,
  ReportPageSchema,
  ReportSchema,
  SCHEMA_VERSION,
} from "./schema.ts";

export type UpgradeReason =
  | "migrated"
  | "catalog changed"
  | "repaired"
  | "forced";

export type UpgradeResult = {
  report: Report;
  fromVersion: number;
  toVersion: number;
  /** Descriptions of the migrations that ran, oldest first. */
  migrations: string[];
  /** Why the report was re-merged; empty when it was already current. */
  reasons: UpgradeReason[];
  changed: boolean;
};

export class UpgradeError extends Error {
  override name = "UpgradeError";
}

/** The part of a report a re-merge is built from. */
const MergeableSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  source: z.object({ report: z.string() }),
  pages: z.array(ReportPageSchema).min(1),
});

function describe(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
    .join("; ");
}

export function upgradeReport(
  json: unknown,
  catalog: CatalogIndex,
  options: {
    force?: boolean;
    now?: Date;
    migrations?: readonly Migration[];
  } = {},
): UpgradeResult {
  const migrated = migrate(json, { migrations: options.migrations });
  const full = ReportSchema.safeParse(migrated.json);

  const reasons: UpgradeReason[] = [];
  if (migrated.applied.length > 0) reasons.push("migrated");
  if (!full.success) reasons.push("repaired");
  else if (full.data.source.catalogHash !== catalog.hash) {
    reasons.push("catalog changed");
  }
  if (options.force) reasons.push("forced");

  const base = {
    fromVersion: migrated.from,
    toVersion: migrated.to,
    migrations: migrated.applied.map((m) => m.description),
  };

  if (reasons.length === 0 && full.success) {
    return { ...base, report: full.data, reasons, changed: false };
  }

  const mergeable = MergeableSchema.safeParse(migrated.json);
  if (!mergeable.success) {
    throw new UpgradeError(
      `cannot re-merge: ${describe(mergeable.error)}${
        full.success ? "" : ` (report also invalid: ${describe(full.error)})`
      }`,
    );
  }

  const report = buildReport(
    mergeable.data.pages,
    {
      report: mergeable.data.source.report,
      catalogHash: catalog.hash,
      mergedAt: (options.now ?? new Date()).toISOString(),
    },
    catalog,
  );
  return {
    ...base,
    report: ReportSchema.parse(report),
    reasons,
    changed: true,
  };
}
