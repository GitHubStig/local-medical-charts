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
 * the catalog — reports are used as imported. PDFs and photos aren't really
 * read: each page takes a moment and comes out as a fictional sample report.
 * Never part of a production build.
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
import { sniffType } from "../../../desktop/imports/file-types.ts";
import { importMessages } from "../../../desktop/imports/messages.ts";
import {
  type NamedBytes,
  unpackFiles,
} from "../../../desktop/imports/packed-files.ts";
import type {
  FiledReport,
  ImportFiling,
  ImportJob,
  ImportPage,
  ImportStart,
  OcrModel,
  OcrTest,
} from "../../../desktop/contract.ts";
import { SAMPLE_REPORTS } from "./samples.ts";

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
    name: "qwen3-vl:4b",
    readsImages: true,
    parameterSize: "4.4B",
    contextLength: 262144,
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

type FakeImport = {
  job: ImportJob;
  pages: ImportPage[];
  report: Report | null;
};

/** What every pretend reading comes out as: a fictional sample. */
const PRETEND_READING = SAMPLE_REPORTS.find((r) =>
  r.name.startsWith("sam-rivera")
)!;

/** Why an upload can't be read, in the desktop's words; null when it can. */
function uploadFilesProblem(files: NamedBytes[]): string | null {
  if (files.length === 0) return importMessages.empty();
  for (const file of files) {
    if (!sniffType(file.bytes)) return importMessages.unsupported(file.name);
  }
  const pdf = files.find((f) => sniffType(f.bytes) === "application/pdf");
  return pdf && files.length > 1
    ? importMessages.pdfWithOthers(pdf.name)
    : null;
}

/** A report in a few words, as the store describes one it filed. */
function filed(report: Report): FiledReport {
  return {
    patientName: report.patient.name,
    collectedAt: report.collectedAt,
    providerName: report.provider.name,
    resultCount: report.tests.length,
  };
}

/** Page objects counted in a PDF's text: enough for pretending. At least one. */
function countPdfPages(bytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(bytes);
  return Math.max(1, text.match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0);
}

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
    /** How long a pretend page takes to read. */
    pageMs?: number;
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
        summary: filed(duplicate.report),
      };
    }

    const filing = filingFor(report);
    if (!filing.identity) {
      return rejected(
        `${file.name}: the report has no patient ID number, or name and date of birth, to file it under`,
      );
    }
    const { warnings } = filing;
    let patientId = filing.patientId;
    if (patientId === undefined) {
      patientId = nextPatientId++;
      patientIds.set(filing.identity, patientId);
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
      summary: filed(report),
    };
  }

  /** Who a report's identity already belongs to, and what saving it would warn about. */
  function filingFor(report: Report) {
    const identity = patientIdentity(report.patient);
    const warnings: string[] = [];
    if (!identity) return { identity, patientId: undefined, warnings };
    const incoming = {
      name: report.patient.name,
      dateOfBirth: report.patient.dateOfBirthIso,
    };
    const patientId = patientIds.get(identity);
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
    }
    return { identity, patientId, warnings };
  }

  function previewFiling(report: Report): ImportFiling {
    const { identity, patientId, warnings } = filingFor(report);
    if (!identity) return { patient: null, warnings, similarReport: null };
    const known = patientId === undefined ? null : summary(patientId);
    if (patientId === undefined || !known) {
      return {
        patient: { kind: "new", name: report.patient.name },
        warnings,
        similarReport: null,
      };
    }
    const similar = report.collectedAt
      ? reports.find((r) =>
        r.patientId === patientId &&
        r.report.collectedAt === report.collectedAt &&
        r.report.provider.name === report.provider.name
      )
      : undefined;
    return {
      patient: {
        kind: "existing",
        id: patientId,
        name: known.name,
        matchedBy: identity.startsWith("id:")
          ? "id-number"
          : "name-and-birth-date",
      },
      warnings,
      similarReport: similar
        ? { id: similar.id, fileName: similar.fileName }
        : null,
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

  // ---- Reading PDFs and photos, pretended. Each page "takes" pageMs, one import
  // at a time, and every upload reads as a copy of a fictional sample report,
  // dated now. Same lifecycle and wording as desktop/imports/queue.ts.
  const pageMs = options.pageMs ?? 1500;
  let imports: FakeImport[] = [];
  let nextImportId = 1;
  let pageTimer: ReturnType<typeof setTimeout> | null = null;

  const snapshot = (item: FakeImport): ImportJob => ({
    ...item.job,
    fileNames: [...item.job.fileNames],
  });
  const findImport = (id: number) => imports.find((i) => i.job.id === id);

  /** Starts an import reading; fails it straight away when no model is chosen. */
  function startReading(item: FakeImport): boolean {
    const at = now().toISOString();
    Object.assign(item.job, {
      status: "reading",
      startedAt: at,
      finishedAt: null,
      error: null,
    });
    if (!settings.ocrModel) {
      Object.assign(item.job, {
        status: "failed",
        finishedAt: at,
        error: importMessages.noModel(),
      });
      return false;
    }
    item.job.model = settings.ocrModel;
    return true;
  }

  function finishReading(item: FakeImport) {
    const at = now().toISOString();
    const template = JSON.parse(PRETEND_READING.text) as Report;
    const base = item.job.fileNames[0].replace(/\.[^.]+$/, "");
    item.report = {
      ...template,
      source: {
        ...template.source,
        report: base,
        images: item.pages.length
          ? item.pages.map((p) => p.name)
          : Array.from({ length: item.job.pageCount }, (_, i) =>
            `${base}-${i + 1}.png`),
        pages: item.job.pageCount,
        model: item.job.model ?? "",
        extractedAt: at,
        mergedAt: at,
      },
      // Dated now, so saving it adds a new point to the charts rather than a duplicate.
      collectedAt: `${at.slice(0, 16)}:00`,
    };
    Object.assign(item.job, {
      status: "ready",
      finishedAt: at,
      resultCount: item.report.tests.length,
    });
  }

  /** Drops the page in progress, so the next import starts reading straight away. */
  function restartPages() {
    if (pageTimer !== null) clearTimeout(pageTimer);
    pageTimer = null;
    pumpImports();
  }

  function pumpImports() {
    if (pageTimer !== null) return;
    let reading = imports.find((i) => i.job.status === "reading");
    while (!reading) {
      const next = imports.find((i) => i.job.status === "waiting");
      if (!next) return;
      if (startReading(next)) reading = next;
    }
    pageTimer = setTimeout(() => {
      pageTimer = null;
      const current = imports.find((i) => i.job.status === "reading");
      if (current && ++current.job.pagesRead >= current.job.pageCount) {
        finishReading(current);
      }
      pumpImports();
    }, pageMs);
  }

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
        imports = [];
        restartPages();
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

    startImport: (files, bytes) =>
      settle((): ImportStart => {
        const upload = unpackFiles(files, bytes);
        const fileNames = upload.map((f) => f.name);
        const problem = uploadFilesProblem(upload);
        if (problem) return { ok: false, fileNames, error: problem };
        const pdf = upload.find((f) =>
          sniffType(f.bytes) === "application/pdf"
        );
        const item: FakeImport = {
          job: {
            id: nextImportId++,
            fileNames,
            source: pdf ? "pdf" : "photos",
            pageCount: pdf ? countPdfPages(pdf.bytes) : upload.length,
            pagesRead: 0,
            status: "waiting",
            model: null,
            addedAt: now().toISOString(),
            startedAt: null,
            finishedAt: null,
            error: null,
            resultCount: null,
          },
          // A PDF can't be drawn without mupdf, so only photos have page images here.
          pages: pdf ? [] : upload.map((f) => ({
            name: f.name,
            type: sniffType(f.bytes) as ImportPage["type"],
            bytes: f.bytes,
            origin: "photo" as const,
          })),
          report: null,
        };
        imports.push(item);
        pumpImports();
        return { ok: true, job: snapshot(item) };
      }),

    listImports: () => settle(() => imports.map(snapshot)),

    cancelImport: (importId) =>
      settle(() => {
        const item = findImport(importId);
        if (!item) return null;
        if (item.job.status === "waiting" || item.job.status === "reading") {
          const wasReading = item.job.status === "reading";
          item.job.status = "cancelled";
          item.job.finishedAt = now().toISOString();
          if (wasReading) restartPages();
        }
        return snapshot(item);
      }),

    retryImport: (importId) =>
      settle(() => {
        const item = findImport(importId);
        if (!item) return null;
        if (item.job.status === "failed" || item.job.status === "cancelled") {
          Object.assign(item.job, {
            status: "waiting",
            error: null,
            finishedAt: null,
          });
          pumpImports();
        }
        return snapshot(item);
      }),

    discardImport: (importId) =>
      settle(() => {
        const item = findImport(importId);
        if (!item) return false;
        imports = imports.filter((i) => i !== item);
        if (item.job.status === "reading") restartPages();
        return true;
      }),

    getImportReview: (importId) =>
      settle(() => {
        const item = findImport(importId);
        return item?.job.status === "ready" && item.report
          ? {
            job: snapshot(item),
            report: withoutPages(item.report),
            filing: previewFiling(item.report),
          }
          : null;
      }),

    getImportPage: (importId, page) =>
      settle(() => {
        const image = findImport(importId)?.pages[page - 1];
        return image ? { ...image } : null;
      }),

    saveImport: (importId) =>
      settle(() => {
        const item = findImport(importId);
        if (item?.job.status !== "ready" || !item.report) {
          throw new Error(`import ${importId} isn't ready to save`);
        }
        const outcome = add({
          name: item.job.fileNames.join(", "),
          text: JSON.stringify(item.report),
        });
        if (outcome.status !== "rejected") {
          imports = imports.filter((i) => i !== item);
        }
        return outcome;
      }),
  };
}
