/**
 * The database's own versioning, separate from the report JSON's
 * `schemaVersion`: this covers tables and columns, not report contents.
 *
 * The version lives in SQLite's `PRAGMA user_version`. To change the tables,
 * append a migration with the next version number — never edit one that has
 * shipped, because existing databases have already run it.
 */
import type { DatabaseSync } from "node:sqlite";

export type DatabaseMigration = {
  version: number;
  description: string;
  sql: string;
};

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    description: "patients, reports and results",
    sql: `
      CREATE TABLE patients (
        id            INTEGER PRIMARY KEY,
        -- Normalized ID number, or name and date of birth when there is none.
        identity_key  TEXT NOT NULL UNIQUE,
        name          TEXT,
        id_number     TEXT,
        date_of_birth TEXT,
        sex           TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE reports (
        id                      INTEGER PRIMARY KEY,
        patient_id              INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
        -- SHA-256 of the uploaded JSON's content, to skip re-uploads.
        content_hash            TEXT NOT NULL UNIQUE,
        file_name               TEXT NOT NULL,
        -- The upload exactly as received. Never modified: upgrades start from it.
        original_json           TEXT NOT NULL,
        original_schema_version INTEGER NOT NULL,
        -- The report upgraded to the current format and catalog.
        report_json             TEXT NOT NULL,
        schema_version          INTEGER NOT NULL,
        catalog_hash            TEXT NOT NULL,
        collected_at            TEXT,
        provider_name           TEXT,
        -- 'failed' when the latest upgrade failed; report_json is then stale.
        status                  TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
        error                   TEXT,
        imported_at             TEXT NOT NULL,
        upgraded_at             TEXT NOT NULL
      );
      CREATE INDEX reports_by_patient ON reports (patient_id, collected_at);

      -- One row per result, rebuilt from report_json whenever the report is
      -- upgraded, so charts can query a test's history without parsing JSON.
      CREATE TABLE results (
        id             INTEGER PRIMARY KEY,
        report_id      INTEGER NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
        patient_id     INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
        position       INTEGER NOT NULL,
        analyte        TEXT,
        specimen       TEXT,
        name           TEXT NOT NULL,
        collected_at   TEXT,
        result_kind    TEXT NOT NULL CHECK (result_kind IN ('numeric', 'comparator', 'text')),
        value          REAL,
        op             TEXT,
        text           TEXT,
        unit           TEXT,
        standard_value REAL,
        standard_op    TEXT,
        standard_unit  TEXT,
        range_json     TEXT,
        flag           TEXT,
        flag_source    TEXT,
        page           INTEGER NOT NULL
      );
      CREATE INDEX results_by_series ON results (patient_id, analyte, collected_at);
    `,
  },
];

export class DatabaseVersionError extends Error {
  override name = "DatabaseVersionError";
}

export function databaseVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  return row.user_version;
}

/** Brings the database's tables up to the latest version, one migration at a time. */
export function migrateDatabase(
  db: DatabaseSync,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
): { from: number; to: number; applied: string[] } {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new DatabaseVersionError(
        `database migrations must be numbered 1, 2, 3…; found ${m.version} at position ${
          i + 1
        }`,
      );
    }
  });

  const latest = migrations.length;
  const from = databaseVersion(db);
  if (from > latest) {
    throw new DatabaseVersionError(
      `the database is version ${from}, newer than this app supports (${latest}) — update the app`,
    );
  }

  const applied: string[] = [];
  for (const migration of migrations.slice(from)) {
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      // Part of the same transaction, so a failed migration leaves the version unchanged.
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new DatabaseVersionError(
        `database migration ${migration.version} (${migration.description}) failed: ${
          err instanceof Error ? err.message : err
        }`,
        { cause: err },
      );
    }
    applied.push(migration.description);
  }
  return { from, to: databaseVersion(db), applied };
}
