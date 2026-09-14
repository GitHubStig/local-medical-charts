/**
 * An in-memory stand-in for the desktop bindings, used by `deno task dev` in a
 * browser, where there is no Deno side to call.
 *
 * It implements the same contract as desktop/bindings.ts and is held to it by
 * the shared contract tests (desktop/contract_suite.ts), so UI built against it
 * behaves the same in the desktop window. It reuses the same pure functions for
 * patient grouping and result rows.
 *
 * What it doesn't do: no SQLite, and no upgrading or re-merging reports against
 * the catalog — reports are used as imported. Never part of a production build.
 */
import type {
  DashboardReport,
  DesktopBindings,
  ImportFile,
  ImportOutcome,
  PatientSummary,
  Settings,
  StartupStatus,
  StoredResult,
} from "../../../desktop/contract.ts";
import {
  patientIdentity,
  resultsFromReport,
  withoutPages,
} from "../../../desktop/report-data.ts";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseSettingsPatch,
} from "../../../desktop/settings.ts";
import { ocrMessages } from "../../../desktop/ocr/messages.ts";
import type { OcrModel, OcrTest } from "../../../desktop/contract.ts";

/** What browser development shows as installed models. Fictional. */
const FAKE_MODELS: OcrModel[] = [
  {
    name: "gemma3:27b",
    readsImages: true,
    parameterSize: "27B",
    contextLength: 131072,
  },
  {
    name: "llama3.3:70b",
    readsImages: false,
    parameterSize: "70B",
    contextLength: 131072,
  },
  {
    name: "nomic-embed-text",
    readsImages: false,
    parameterSize: "137M",
    contextLength: 2048,
  },
  {
    name: "qwen3.8:27b-mlx",
    readsImages: true,
    parameterSize: "27.8B",
    contextLength: 262144,
  },
];

/** Test connection against the fake model list: no network, same wording as the real checks. */
function fakeOcrTest(host: string, model: string | null): OcrTest {
  const checks: OcrTest["checks"] = [
    {
      step: "reachable",
      ok: true,
      message: ocrMessages.running("0.0.0-fake", host),
    },
  ];
  const found = FAKE_MODELS.find((m) => m.name === model);
  if (!model) {
    checks.push({
      step: "installed",
      ok: false,
      message: ocrMessages.noModel(),
    });
  } else if (!found) {
    checks.push({
      step: "installed",
      ok: false,
      message: ocrMessages.notInstalled(model),
    });
  } else {
    checks.push({
      step: "installed",
      ok: true,
      message: ocrMessages.installed(model),
    });
    checks.push(
      found.readsImages
        ? { step: "reads-images", ok: true, message: ocrMessages.readOk(1.2) }
        : {
          step: "reads-images",
          ok: false,
          message: ocrMessages.cantReadImages(model),
        },
    );
  }
  return {
    host,
    model,
    ok: checks.length === 3 && checks.every((c) => c.ok),
    checks,
  };
}
import {
  idMatchWarnings,
  sameNameAndBirthDate,
  sameNameDifferentIdWarning,
  uploadProblem,
} from "../../../desktop/upload-checks.ts";
import type { Report } from "../../../src/schema.ts";

type SettingsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type FakeReport = {
  id: number;
  patientId: number;
  fileName: string;
  content: string;
  report: Report;
  importedAt: string;
};

const SETTINGS_KEY = "medical-charts:fake-settings";

const STARTUP: StartupStatus = {
  ok: true,
  databasePath: "in memory (browser development)",
  schemaVersion: 1,
  catalogHash: "fake",
  upgrade: { checked: 0, upgraded: 0, failed: [] },
};

function settle<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
}

/** Nulls first, matching SQLite's ORDER BY. */
function compareNullable(
  a: string | number | null,
  b: string | number | null,
): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/**
 * The fake can't run the Zod schema, so beyond the shared upload checks it only
 * confirms the parts it reads. (The real store would rebuild missing results
 * from the embedded pages; the fake just refuses.)
 */
function hasFieldsFakeUses(json: object): json is Report {
  const r = json as Partial<Report>;
  return Array.isArray(r.tests) && !!r.patient && typeof r.patient === "object";
}

export function createFakeBindings(
  options: {
    /** Reports to start with, e.g. the samples. */
    reports?: ImportFile[];
    /** Where settings survive a page reload; in-memory when omitted. */
    storage?: SettingsStorage;
    now?: () => Date;
  } = {},
): DesktopBindings {
  const now = options.now ?? (() => new Date());
  const patientIds = new Map<string, number>();
  let reports: FakeReport[] = [];
  let nextPatientId = 1;
  let nextReportId = 1;

  let settings: Settings;
  try {
    const raw = options.storage?.getItem(SETTINGS_KEY);
    settings = normalizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  // Newest collection date first, reports without a date last (as in SQLite).
  const byNewest = (a: FakeReport, b: FakeReport) => {
    const ac = a.report.collectedAt, bc = b.report.collectedAt;
    if (ac === null && bc !== null) return 1;
    if (bc === null && ac !== null) return -1;
    return compareNullable(bc, ac) || b.id - a.id;
  };

  function add(file: ImportFile): ImportOutcome {
    const rejected = (error: string): ImportOutcome => ({
      fileName: file.name,
      status: "rejected",
      error,
    });

    let json: unknown;
    try {
      json = JSON.parse(file.text);
    } catch (err) {
      return rejected(
        `${file.name} is not valid JSON: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
    const problem = uploadProblem(json);
    if (problem) return rejected(`${file.name}: ${problem}`);
    const report = json as object;
    if (!hasFieldsFakeUses(report)) {
      return rejected(
        `${file.name}: not a merged report (missing tests or patient)`,
      );
    }

    const content = JSON.stringify(json);
    const duplicate = reports.find((r) => r.content === content);
    if (duplicate) {
      return {
        fileName: file.name,
        status: "duplicate",
        patientId: duplicate.patientId,
        reportId: duplicate.id,
        warnings: [],
      };
    }

    const identity = patientIdentity(report.patient);
    if (!identity) {
      return rejected(
        `${file.name}: the report has no patient ID number, or name and date of birth, to file it under`,
      );
    }
    const incoming = {
      name: report.patient.name,
      dateOfBirth: report.patient.dateOfBirthIso,
    };
    const warnings: string[] = [];
    let patientId = patientIds.get(identity);
    if (patientId !== undefined) {
      const known = summary(patientId);
      if (known && identity.startsWith("id:")) {
        warnings.push(...idMatchWarnings(known, incoming));
      }
    } else {
      const lookalike = [...patientIds.values()]
        .map(summary)
        .some((p) => p && sameNameAndBirthDate(incoming, p));
      if (lookalike) warnings.push(sameNameDifferentIdWarning(incoming.name));
      patientId = nextPatientId++;
      patientIds.set(identity, patientId);
    }

    const id = nextReportId++;
    reports.push({
      id,
      patientId,
      fileName: file.name,
      content,
      report,
      importedAt: now().toISOString(),
    });
    return {
      fileName: file.name,
      status: "added",
      patientId,
      reportId: id,
      warnings,
    };
  }

  function summary(patientId: number): PatientSummary | null {
    const own = reports.filter((r) => r.patientId === patientId).sort(byNewest);
    if (own.length === 0) return null;
    const { patient } = own[0].report;
    const dates = own.map((r) => r.report.collectedAt)
      .filter((d): d is string => d !== null)
      .sort();
    return {
      id: patientId,
      name: patient.name,
      idNumber: patient.idNumber,
      dateOfBirth: patient.dateOfBirthIso,
      sex: patient.sex,
      reportCount: own.length,
      failedReportCount: 0,
      firstCollectedAt: dates[0] ?? null,
      lastCollectedAt: dates.at(-1) ?? null,
    };
  }

  for (const file of options.reports ?? []) add(file);

  return {
    getStartupStatus: () => settle(() => STARTUP),

    listPatients: () =>
      settle(() =>
        [...new Set(reports.map((r) => r.patientId))]
          .map(summary)
          .filter((p): p is PatientSummary => p !== null)
          .sort((a, b) =>
            (a.name ?? "").localeCompare(b.name ?? "", undefined, {
              sensitivity: "base",
            }) || a.id - b.id
          )
      ),

    getDashboard: (patientId) =>
      settle(() => {
        const patient = summary(patientId);
        if (!patient) return null;
        const own = reports.filter((r) => r.patientId === patientId);
        const dashboardReports: DashboardReport[] = [...own].sort(byNewest).map(
          (
            r,
          ) => ({
            id: r.id,
            patientId,
            fileName: r.fileName,
            collectedAt: r.report.collectedAt,
            providerName: r.report.provider.name,
            status: "ok",
            error: null,
            schemaVersion: r.report.schemaVersion,
            catalogHash: r.report.source.catalogHash,
            importedAt: r.importedAt,
            upgradedAt: r.importedAt,
            report: withoutPages(r.report),
          }),
        );
        const results: StoredResult[] = own
          .flatMap((r) => resultsFromReport(r.id, r.report))
          .sort((a, b) =>
            compareNullable(a.analyte, b.analyte) ||
            compareNullable(a.collectedAt, b.collectedAt) ||
            a.reportId - b.reportId || a.position - b.position
          );
        return { patient, reports: dashboardReports, results };
      }),

    importReports: (files) => settle(() => files.map(add)),

    deleteReport: (reportId) =>
      settle(() => {
        const before = reports.length;
        reports = reports.filter((r) => r.id !== reportId);
        return reports.length < before;
      }),

    clearAll: () =>
      settle(() => {
        reports = [];
        patientIds.clear();
      }),

    getSettings: () => settle(() => ({ ...settings })),

    updateSettings: (patch) =>
      settle(() => {
        settings = normalizeSettings({
          ...settings,
          ...parseSettingsPatch(patch),
        });
        options.storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return { ...settings };
      }),

    listOcrModels: () =>
      settle(() => ({
        ok: true as const,
        host: settings.ollamaHost,
        version: "0.0.0-fake",
        models: FAKE_MODELS.map((m) => ({ ...m })),
      })),

    testOcr: () =>
      settle(() => fakeOcrTest(settings.ollamaHost, settings.ocrModel)),
  };
}
