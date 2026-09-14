/**
 * The app's report store, in SQLite.
 *
 * Each report keeps the upload exactly as received next to the version
 * upgraded to the current format and catalog. Upgrades always start again from
 * the original, so a bad migration can be fixed and re-run without data loss.
 *
 * Synchronous on purpose: node:sqlite's DatabaseSync is fast for a single local
 * user, and it keeps transactions simple.
 */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { dirname } from "@std/path";
import type { CatalogIndex } from "../../src/catalog.ts";
import type { Report } from "../../src/schema.ts";
import { SCHEMA_VERSION } from "../../src/schema.ts";
import { upgradeReport } from "../../src/upgrade.ts";
import { patientIdentity, resultsFromReport } from "../report-data.ts";
import { normalizeSettings, type Settings } from "../settings.ts";
import {
  idMatchWarnings,
  sameNameAndBirthDate,
  sameNameDifferentIdWarning,
  uploadProblem,
} from "../upload-checks.ts";
import type {
  AddReportResult,
  ImportFiling,
  PatientSummary,
  ReportSummary,
  StoredResult,
  UpgradeSummary,
} from "../types.ts";
import { assertExpectedTables, migrateDatabase } from "./db-migrations.ts";

export { patientIdentity };
export type {
  AddReportResult,
  PatientSummary,
  ReportSummary,
  StoredResult,
  UpgradeSummary,
};

export class StoreError extends Error {
  override name = "StoreError";
}

function contentHash(json: unknown): string {
  return createHash("sha256").update(JSON.stringify(json)).digest("hex");
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type Row = Record<string, unknown>;

export class ReportStore {
  readonly #db: DatabaseSync;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /** Opens (creating if needed) a database file, or `":memory:"` for tests. */
  static open(path: string): ReportStore {
    if (path !== ":memory:") Deno.mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys = ON");
    if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
    try {
      migrateDatabase(db);
      assertExpectedTables(db);
    } catch (err) {
      db.close();
      throw err;
    }
    return new ReportStore(db);
  }

  close(): void {
    this.#db.close();
  }

  #transaction<T>(fn: () => T): T {
    this.#db.exec("BEGIN");
    try {
      const result = fn();
      this.#db.exec("COMMIT");
      return result;
    } catch (err) {
      this.#db.exec("ROLLBACK");
      throw err;
    }
  }

  /**
   * Adds an uploaded report: upgrades it to the current format and catalog,
   * files it under its patient, and indexes its results. A report already in
   * the store is skipped. Anything invalid throws and nothing is stored.
   */
  addReport(
    text: string,
    fileName: string,
    catalog: CatalogIndex,
    now = new Date(),
  ): AddReportResult {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new StoreError(`${fileName} is not valid JSON: ${message(err)}`);
    }
    const problem = uploadProblem(json);
    if (problem) throw new StoreError(`${fileName}: ${problem}`);

    const hash = contentHash(json);
    const existing = this.#db
      .prepare(
        `SELECT id, patient_id, report_json,
           (SELECT COUNT(*) FROM results WHERE report_id = reports.id) AS result_count
         FROM reports WHERE content_hash = ?`,
      )
      .get(hash) as Row | undefined;
    if (existing) {
      const stored = JSON.parse(String(existing.report_json)) as Report;
      return {
        status: "duplicate",
        reportId: Number(existing.id),
        patientId: Number(existing.patient_id),
        warnings: [],
        summary: {
          patientName: stored.patient.name,
          collectedAt: stored.collectedAt,
          providerName: stored.provider.name,
          resultCount: Number(existing.result_count),
        },
      };
    }

    let upgraded;
    try {
      upgraded = upgradeReport(json, catalog, { now });
    } catch (err) {
      throw new StoreError(`${fileName}: ${message(err)}`, { cause: err });
    }
    const report = upgraded.report;

    const identity = patientIdentity(report.patient);
    if (!identity) {
      throw new StoreError(
        `${fileName}: the report has no patient ID number, or name and date of birth, to file it under`,
      );
    }

    const at = now.toISOString();
    return this.#transaction(() => {
      const { warnings } = this.#filing(identity, report);

      this.#db
        .prepare(
          `INSERT INTO patients (identity_key, created_at, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (identity_key) DO NOTHING`,
        )
        .run(identity, at, at);
      const patientId = Number(
        (this.#db.prepare("SELECT id FROM patients WHERE identity_key = ?").get(
          identity,
        ) as Row).id,
      );

      const inserted = this.#db
        .prepare(
          `INSERT INTO reports (
             patient_id, content_hash, file_name, original_json, original_schema_version,
             report_json, schema_version, catalog_hash, collected_at, provider_name,
             status, error, imported_at, upgraded_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?)`,
        )
        .run(
          patientId,
          hash,
          fileName,
          text,
          upgraded.fromVersion,
          JSON.stringify(report),
          report.schemaVersion,
          report.source.catalogHash,
          report.collectedAt,
          report.provider.name,
          at,
          at,
        );
      const reportId = Number(inserted.lastInsertRowid);

      this.#writeResults(reportId, patientId, report);
      this.#refreshPatient(patientId, at);
      return {
        status: "added",
        reportId,
        patientId,
        warnings,
        summary: {
          patientName: report.patient.name,
          collectedAt: report.collectedAt,
          providerName: report.provider.name,
          resultCount: report.tests.length,
        },
      };
    });
  }

  /**
   * Where a report would be filed and what's worth checking first, decided as
   * saving it would decide, without storing anything.
   */
  previewFiling(report: Report): ImportFiling {
    const identity = patientIdentity(report.patient);
    if (!identity) return { patient: null, warnings: [], similarReport: null };
    const { known, warnings } = this.#filing(identity, report);
    if (!known) {
      return {
        patient: { kind: "new", name: report.patient.name },
        warnings,
        similarReport: null,
      };
    }
    const similar = report.collectedAt
      ? this.#db
        .prepare(
          `SELECT id, file_name FROM reports
           WHERE patient_id = ? AND collected_at = ? AND provider_name IS ?
           ORDER BY id LIMIT 1`,
        )
        .get(known.id, report.collectedAt, report.provider.name) as
          | Row
          | undefined
      : undefined;
    return {
      patient: {
        kind: "existing",
        id: known.id,
        name: known.name,
        matchedBy: identity.startsWith("id:")
          ? "id-number"
          : "name-and-birth-date",
      },
      warnings,
      similarReport: similar
        ? { id: Number(similar.id), fileName: String(similar.file_name) }
        : null,
    };
  }

  /** The patient a report's identity already belongs to, and what filing it there would warn about. */
  #filing(
    identity: string,
    report: Report,
  ): { known: { id: number; name: string | null } | null; warnings: string[] } {
    const incoming = {
      name: report.patient.name,
      dateOfBirth: report.patient.dateOfBirthIso,
    };
    const warnings: string[] = [];
    const known = this.#db
      .prepare(
        "SELECT id, name, date_of_birth FROM patients WHERE identity_key = ?",
      )
      .get(identity) as Row | undefined;

    if (known && identity.startsWith("id:")) {
      warnings.push(...idMatchWarnings(
        {
          name: known.name as string | null,
          dateOfBirth: known.date_of_birth as string | null,
        },
        incoming,
      ));
    } else if (!known) {
      const others = this.#db
        .prepare(
          "SELECT name, date_of_birth FROM patients WHERE date_of_birth = ?",
        )
        .all(incoming.dateOfBirth) as Row[];
      const lookalike = others.some((o) =>
        sameNameAndBirthDate(incoming, {
          name: o.name as string | null,
          dateOfBirth: o.date_of_birth as string | null,
        })
      );
      if (lookalike) warnings.push(sameNameDifferentIdWarning(incoming.name));
    }
    return {
      known: known
        ? { id: Number(known.id), name: known.name as string | null }
        : null,
      warnings,
    };
  }

  /**
   * Re-upgrades every report whose stored format or catalog is out of date, or
   * whose last upgrade failed — from its original upload each time. Meant to
   * run on launch. A report that fails is marked failed and kept, not deleted.
   */
  upgradeAll(catalog: CatalogIndex, now = new Date()): UpgradeSummary {
    const rows = this.#db
      .prepare(
        "SELECT id, patient_id, file_name, original_json, schema_version, catalog_hash, status FROM reports ORDER BY id",
      )
      .all() as Row[];
    const at = now.toISOString();
    const summary: UpgradeSummary = {
      checked: rows.length,
      upgraded: 0,
      failed: [],
    };

    for (const row of rows) {
      const current = row.schema_version === SCHEMA_VERSION &&
        row.catalog_hash === catalog.hash && row.status === "ok";
      if (current) continue;

      const reportId = Number(row.id), patientId = Number(row.patient_id);
      try {
        const { report } = upgradeReport(
          JSON.parse(String(row.original_json)),
          catalog,
          { now },
        );
        this.#transaction(() => {
          this.#db
            .prepare(
              `UPDATE reports SET report_json = ?, schema_version = ?, catalog_hash = ?,
                 collected_at = ?, provider_name = ?, status = 'ok', error = NULL, upgraded_at = ?
               WHERE id = ?`,
            )
            .run(
              JSON.stringify(report),
              report.schemaVersion,
              report.source.catalogHash,
              report.collectedAt,
              report.provider.name,
              at,
              reportId,
            );
          this.#writeResults(reportId, patientId, report);
          this.#refreshPatient(patientId, at);
        });
        summary.upgraded++;
      } catch (err) {
        this.#db
          .prepare(
            "UPDATE reports SET status = 'failed', error = ?, upgraded_at = ? WHERE id = ?",
          )
          .run(message(err), at, reportId);
        summary.failed.push({
          reportId,
          fileName: String(row.file_name),
          error: message(err),
        });
      }
    }
    return summary;
  }

  listPatients(): PatientSummary[] {
    const rows = this.#db
      .prepare(
        `SELECT p.id, p.name, p.id_number, p.date_of_birth, p.sex,
           COUNT(r.id) FILTER (WHERE r.status = 'ok')     AS report_count,
           COUNT(r.id) FILTER (WHERE r.status = 'failed') AS failed_report_count,
           MIN(r.collected_at) FILTER (WHERE r.status = 'ok') AS first_collected_at,
           MAX(r.collected_at) FILTER (WHERE r.status = 'ok') AS last_collected_at
         FROM patients p LEFT JOIN reports r ON r.patient_id = p.id
         GROUP BY p.id
         ORDER BY p.name COLLATE NOCASE, p.id`,
      )
      .all() as Row[];
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name as string | null,
      idNumber: r.id_number as string | null,
      dateOfBirth: r.date_of_birth as string | null,
      sex: r.sex as string | null,
      reportCount: Number(r.report_count),
      failedReportCount: Number(r.failed_report_count),
      firstCollectedAt: r.first_collected_at as string | null,
      lastCollectedAt: r.last_collected_at as string | null,
    }));
  }

  listReports(patientId: number): ReportSummary[] {
    const rows = this.#db
      .prepare(
        `SELECT id, patient_id, file_name, collected_at, provider_name, status, error,
           schema_version, catalog_hash, imported_at, upgraded_at
         FROM reports WHERE patient_id = ?
         ORDER BY collected_at IS NULL, collected_at DESC, id DESC`,
      )
      .all(patientId) as Row[];
    return rows.map((r) => ({
      id: Number(r.id),
      patientId: Number(r.patient_id),
      fileName: String(r.file_name),
      collectedAt: r.collected_at as string | null,
      providerName: r.provider_name as string | null,
      status: r.status as "ok" | "failed",
      error: r.error as string | null,
      schemaVersion: Number(r.schema_version),
      catalogHash: String(r.catalog_hash),
      importedAt: String(r.imported_at),
      upgradedAt: String(r.upgraded_at),
    }));
  }

  /** The upgraded report, or null when there is no such report or its upgrade failed. */
  getReport(reportId: number): Report | null {
    const row = this.#db
      .prepare("SELECT report_json FROM reports WHERE id = ? AND status = 'ok'")
      .get(reportId) as Row | undefined;
    return row ? JSON.parse(String(row.report_json)) as Report : null;
  }

  /** The report exactly as it was uploaded, whatever its upgrade status. */
  getOriginalJson(reportId: number): string | null {
    const row = this.#db
      .prepare("SELECT original_json FROM reports WHERE id = ?")
      .get(reportId) as Row | undefined;
    return row ? String(row.original_json) : null;
  }

  /** Every result for a patient from reports in good standing, oldest first per test. */
  resultsForPatient(patientId: number): StoredResult[] {
    const rows = this.#db
      .prepare(
        `SELECT res.* FROM results res JOIN reports rep ON rep.id = res.report_id
         WHERE res.patient_id = ? AND rep.status = 'ok'
         ORDER BY res.analyte, res.collected_at, res.report_id, res.position`,
      )
      .all(patientId) as Row[];
    return rows.map((r) => ({
      reportId: Number(r.report_id),
      position: Number(r.position),
      analyte: r.analyte as string | null,
      specimen: r.specimen as string | null,
      name: String(r.name),
      collectedAt: r.collected_at as string | null,
      resultKind: r.result_kind as StoredResult["resultKind"],
      value: r.value as number | null,
      op: r.op as string | null,
      text: r.text as string | null,
      unit: r.unit as string | null,
      standardValue: r.standard_value as number | null,
      standardOp: r.standard_op as string | null,
      standardUnit: r.standard_unit as string | null,
      range: r.range_json ? JSON.parse(String(r.range_json)) : null,
      flag: r.flag as string | null,
      flagSource: r.flag_source as string | null,
      page: Number(r.page),
    }));
  }

  /** Deletes a report and its results; a patient left with no reports is removed too. */
  deleteReport(reportId: number, now = new Date()): boolean {
    return this.#transaction(() => {
      const row = this.#db
        .prepare("SELECT patient_id FROM reports WHERE id = ?")
        .get(reportId) as Row | undefined;
      if (!row) return false;
      this.#db.prepare("DELETE FROM reports WHERE id = ?").run(reportId);
      this.#refreshPatient(Number(row.patient_id), now.toISOString());
      return true;
    });
  }

  /** The app's settings, with defaults for anything never set. */
  getSettings(): Settings {
    const rows = this.#db
      .prepare("SELECT key, value_json FROM settings")
      .all() as Row[];
    return normalizeSettings(
      Object.fromEntries(
        rows.map((r) => [String(r.key), JSON.parse(String(r.value_json))]),
      ),
    );
  }

  /** Saves the given settings (already validated) and returns them all. */
  updateSettings(patch: Partial<Settings>, now = new Date()): Settings {
    const at = now.toISOString();
    this.#transaction(() => {
      const upsert = this.#db.prepare(
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      );
      for (const [key, value] of Object.entries(patch)) {
        upsert.run(key, JSON.stringify(value), at);
      }
    });
    return this.getSettings();
  }

  /** Removes every patient, report and result. Settings are kept. */
  clearAll(): void {
    this.#transaction(() => {
      this.#db.exec(
        "DELETE FROM results; DELETE FROM reports; DELETE FROM patients;",
      );
    });
  }

  #writeResults(reportId: number, patientId: number, report: Report): void {
    this.#db.prepare("DELETE FROM results WHERE report_id = ?").run(reportId);
    const insert = this.#db.prepare(
      `INSERT INTO results (
         report_id, patient_id, position, analyte, specimen, name, collected_at,
         result_kind, value, op, text, unit, standard_value, standard_op, standard_unit,
         range_json, flag, flag_source, page
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of resultsFromReport(reportId, report)) {
      insert.run(
        reportId,
        patientId,
        r.position,
        r.analyte,
        r.specimen,
        r.name,
        r.collectedAt,
        r.resultKind,
        r.value,
        r.op,
        r.text,
        r.unit,
        r.standardValue,
        r.standardOp,
        r.standardUnit,
        r.range ? JSON.stringify(r.range) : null,
        r.flag,
        r.flagSource,
        r.page,
      );
    }
  }

  /**
   * Keeps the patient's details in step with their most recent report, or
   * removes the patient once they have no reports at all.
   */
  #refreshPatient(patientId: number, at: string): void {
    const latest = this.#db
      .prepare(
        `SELECT report_json FROM reports WHERE patient_id = ? AND status = 'ok'
         ORDER BY collected_at IS NULL, collected_at DESC, id DESC LIMIT 1`,
      )
      .get(patientId) as Row | undefined;

    if (!latest) {
      const any = this.#db
        .prepare("SELECT 1 FROM reports WHERE patient_id = ? LIMIT 1")
        .get(patientId);
      if (!any) {
        this.#db.prepare("DELETE FROM patients WHERE id = ?").run(patientId);
      }
      return;
    }

    const { patient } = JSON.parse(String(latest.report_json)) as Report;
    this.#db
      .prepare(
        "UPDATE patients SET name = ?, id_number = ?, date_of_birth = ?, sex = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        patient.name,
        patient.idNumber,
        patient.dateOfBirthIso,
        patient.sex,
        at,
        patientId,
      );
  }
}
