/**
 * Behaviour every DesktopBindings implementation must share, run against both
 * the real SQLite-backed bindings (bindings_test.ts) and the browser-dev fake
 * (fake-bindings_test.ts). This is what keeps the fake honest: UI built against
 * it in the browser behaves the same in the desktop window.
 *
 * Only assert behaviour both implementations promise here. Anything specific to
 * one (argument errors, database failures, sample data) belongs in its own tests.
 */
import { assert, assertEquals, assertRejects } from "@std/assert";
import type { DesktopBindings, ImportJob } from "./contract.ts";
import { type NamedBytes, packFiles } from "./imports/packed-files.ts";
import { syntheticReport } from "./store/testing.ts";

export type ContractHarness = {
  bindings: DesktopBindings;
  close?: () => void;
};

export function defineContractTests(
  label: string,
  create: () => ContractHarness,
): void {
  const test = (
    name: string,
    fn: (bindings: DesktopBindings) => Promise<void>,
  ) =>
    Deno.test(`${label}: ${name}`, async () => {
      const harness = create();
      try {
        await fn(harness.bindings);
      } finally {
        harness.close?.();
      }
    });

  test("imports that don't exist are reported as missing", async (b) => {
    assertEquals(await b.listImports(), []);
    assertEquals(await b.cancelImport(999), null);
    assertEquals(await b.retryImport(999), null);
    assertEquals(await b.discardImport(999), false);
    assertEquals(await b.getImportReview(999), null);
    assertEquals(await b.getImportPage(999, 1), null);
    await assertRejects(() => b.saveImport(999));
  });

  test("an upload that isn't a PDF or photos is refused on its own", async (b) => {
    const outcome = await startWith(b, [
      { name: "notes.txt", bytes: new TextEncoder().encode("hi") },
    ]);
    assert(!outcome.ok);
    assertEquals(outcome.fileNames, ["notes.txt"]);
  });

  test("an upload whose sizes don't match its bytes is refused", async (b) => {
    await assertRejects(() =>
      b.startImport([{ name: "IMG_1.png", size: 20 }], PNG_BYTES)
    );
  });

  test("photos are read in the background, reviewed, then saved as a report", async (b) => {
    await b.updateSettings({ ocrModel: "vision-model:27b" });
    const start = await startWith(b, [
      { name: "IMG_1.png", bytes: PNG_BYTES },
      { name: "IMG_2.png", bytes: PNG_BYTES },
    ]);
    assert(start.ok);
    assertEquals([start.job.source, start.job.pageCount], ["photos", 2]);

    const [job] = await settledImports(b);
    assertEquals([job.status, job.pagesRead, job.model], [
      "ready",
      2,
      "vision-model:27b",
    ]);
    assert((job.resultCount ?? 0) > 0);

    const review = await b.getImportReview(job.id);
    assert(review && !("pages" in review.report), "no page transcriptions");
    assertEquals(await b.getImportPage(job.id, 2), {
      name: "IMG_2.png",
      type: "image/png",
      bytes: PNG_BYTES,
      origin: "photo",
    });

    const saved = await b.saveImport(job.id);
    assertEquals(saved.status, "added");
    assertEquals(saved.fileName, "IMG_1.png, IMG_2.png");
    assertEquals((await b.listPatients()).length, 1);
    assertEquals(await b.listImports(), []);
  });

  test("a read report says where it would be filed, and spots one already saved", async (b) => {
    await b.updateSettings({ ocrModel: "vision-model:27b" });
    const files = [{ name: "IMG_1.png", bytes: PNG_BYTES }];

    await startWith(b, files);
    const [first] = await settledImports(b);
    const firstReview = await b.getImportReview(first.id);
    assertEquals(firstReview?.filing.patient?.kind, "new");
    assertEquals(firstReview?.filing.similarReport, null);
    const saved = await b.saveImport(first.id);
    assert(saved.status === "added");

    await startWith(b, files);
    const [second] = await settledImports(b);
    const { filing } = (await b.getImportReview(second.id))!;
    const [patient] = await b.listPatients();
    assertEquals(filing, {
      patient: {
        kind: "existing",
        id: saved.patientId,
        name: patient.name,
        matchedBy: "id-number",
      },
      warnings: [],
      similarReport: { id: saved.reportId, fileName: "IMG_1.png" },
    });
  });

  test("an import waiting its turn can be cancelled, retried and discarded", async (b) => {
    await b.updateSettings({ ocrModel: "vision-model:27b" });
    const files = [{ name: "IMG_1.png", bytes: PNG_BYTES }];
    const first = await startWith(b, files);
    const second = await startWith(b, files);
    assert(first.ok && second.ok);
    assertEquals(second.job.status, "waiting");

    assertEquals((await b.cancelImport(second.job.id))?.status, "cancelled");
    assertEquals(
      (await b.retryImport(second.job.id))?.status !== "cancelled",
      true,
    );
    assertEquals((await settledImports(b)).map((j) => j.status), [
      "ready",
      "ready",
    ]);
    assertEquals(await b.discardImport(second.job.id), true);
    assertEquals((await b.listImports()).map((j) => j.id), [first.job.id]);
  });

  test("without a model, an import fails and says where to choose one", async (b) => {
    await startWith(b, [{ name: "IMG_1.png", bytes: PNG_BYTES }]);
    const [job] = await settledImports(b);
    assertEquals(job.status, "failed");
    assertEquals(
      job.error,
      "Choose a model for reading PDFs and photos in Settings.",
    );
    await assertRejects(
      () => b.saveImport(job.id),
      Error,
      "isn't ready to save",
    );

    await b.clearAll();
    assertEquals(await b.listImports(), [], "Clear all data forgets imports");
  });

  test("startup status is ok", async (b) => {
    assertEquals((await b.getStartupStatus()).ok, true);
  });

  test("each imported file gets its own outcome", async (b) => {
    const text = syntheticReport();
    const outcomes = await b.importReports([
      { name: "jan.json", text },
      { name: "again.json", text },
      { name: "broken.json", text: "{ nope" },
      { name: "other.json", text: '{"hello": 1}' },
    ]);
    assertEquals(outcomes.map((o) => [o.fileName, o.status]), [
      ["jan.json", "added"],
      ["again.json", "duplicate"],
      ["broken.json", "rejected"],
      ["other.json", "rejected"],
    ]);
    const [added, duplicate, broken] = outcomes;
    assert(added.status === "added" && duplicate.status === "duplicate");
    assert(
      broken.status === "rejected" && broken.error.includes("not valid JSON"),
      "a file that isn't JSON says so",
    );
    assertEquals(
      [
        added.summary.patientName,
        added.summary.providerName,
        added.summary.resultCount,
      ],
      ["ALEX EXAMPLE", "Example Lab", 3],
    );
    assert(added.summary.collectedAt?.startsWith("2025-01-14"));
    assertEquals(duplicate.summary, added.summary);
  });

  test("common wrong files are rejected with an explanation", async (b) => {
    const report = JSON.parse(syntheticReport());
    const pageFile = {
      schemaVersion: 1,
      model: "test-model",
      promptHash: "test-prompt",
      extractedAt: "2025-01-15T10:00:00.000Z",
      extraction: report.pages[0].extraction,
    };
    const outcomes = await b.importReports([
      { name: "report-1.page.json", text: JSON.stringify(pageFile) },
      {
        name: "analyte-suggestions.json",
        text: '{"instructions": "", "suggestions": []}',
      },
      {
        name: "future.json",
        text: JSON.stringify({ ...report, schemaVersion: 99 }),
      },
      { name: "list.json", text: "[]" },
    ]);
    const errors = outcomes.map((o) =>
      o.status === "rejected" ? o.error : o.status
    );
    assert(errors[0].includes("single OCR page file"), errors[0]);
    assert(errors[1].includes("suggestions file"), errors[1]);
    assert(errors[2].includes("newer version of the app"), errors[2]);
    assert(errors[3].includes("expected a JSON object"), errors[3]);
    assertEquals(await b.listPatients(), []);
  });

  test("a known ID with a different name or birth date is filed with a warning", async (b) => {
    const [first, renamed, redated] = await b.importReports([
      { name: "a.json", text: syntheticReport() },
      {
        name: "b.json",
        text: syntheticReport({
          patientName: "JORDAN EXAMPLE",
          collected: "20/06/25 09:00",
        }),
      },
      {
        name: "c.json",
        text: syntheticReport({
          dateOfBirth: "16/08/90",
          collected: "20/09/25 09:00",
        }),
      },
    ]);
    assert(first.status === "added" && first.warnings.length === 0);
    assert(renamed.status === "added" && renamed.patientId === first.patientId);
    assertEquals(renamed.warnings.length, 1);
    assert(renamed.warnings[0].includes("check the ID"), renamed.warnings[0]);
    assert(redated.status === "added");
    assert(
      redated.warnings.some((w) => w.includes("date of birth differs")),
      redated.warnings.join(),
    );
    assertEquals((await b.listPatients()).length, 1);
  });

  test("the same name and birth date under another ID starts a new patient, with a warning", async (b) => {
    const [first, other] = await b.importReports([
      { name: "a.json", text: syntheticReport({ idNumber: "X1234567" }) },
      {
        name: "b.json",
        text: syntheticReport({
          idNumber: "Z9999999",
          collected: "20/06/25 09:00",
        }),
      },
    ]);
    assert(first.status === "added" && other.status === "added");
    assert(first.patientId !== other.patientId);
    assertEquals(other.warnings.length, 1);
    assert(
      other.warnings[0].includes("different ID number"),
      other.warnings[0],
    );
  });

  test("reports group by patient ID number", async (b) => {
    await b.importReports([
      { name: "a.json", text: syntheticReport({ idNumber: "X1234567" }) },
      {
        name: "b.json",
        text: syntheticReport({
          idNumber: "x-1234 567",
          collected: "20/06/25 09:00",
        }),
      },
      {
        name: "c.json",
        text: syntheticReport({
          idNumber: "Y7654321",
          patientName: "SAM EXAMPLE",
        }),
      },
    ]);
    const patients = await b.listPatients();
    assertEquals(patients.map((p) => [p.name, p.reportCount]), [
      ["ALEX EXAMPLE", 2],
      ["SAM EXAMPLE", 1],
    ]);
    assertEquals(patients[0].firstCollectedAt, "2025-01-14T08:30:00");
    assertEquals(patients[0].lastCollectedAt, "2025-06-20T09:00:00");
  });

  test("the dashboard lists reports newest first, without OCR pages", async (b) => {
    await b.importReports([
      { name: "jan.json", text: syntheticReport() },
      {
        name: "jun.json",
        text: syntheticReport({
          collected: "20/06/25 09:00",
          haemoglobin: "12.8",
        }),
      },
    ]);
    const [patient] = await b.listPatients();
    const dashboard = (await b.getDashboard(patient.id))!;

    assertEquals(dashboard.patient.reportCount, 2);
    assertEquals(dashboard.reports.map((r) => r.fileName), [
      "jun.json",
      "jan.json",
    ]);
    assert(dashboard.reports.every((r) => r.status === "ok" && r.report));
    assertEquals("pages" in dashboard.reports[0].report!, false);
    assertEquals(
      dashboard.results.filter((r) => r.analyte === "haemoglobin").map((r) => [
        r.collectedAt,
        r.value,
      ]),
      [["2025-01-14T08:30:00", 13.1], ["2025-06-20T09:00:00", 12.8]],
    );
    assertEquals(JSON.parse(JSON.stringify(dashboard)), dashboard, "JSON-safe");
    assertEquals(await b.getDashboard(patient.id + 1000), null);
  });

  test("deleting a patient's last report removes the patient", async (b) => {
    const [first] = await b.importReports([{
      name: "a.json",
      text: syntheticReport(),
    }]);
    assert(first.status === "added");
    assertEquals(await b.deleteReport(first.reportId), true);
    assertEquals(await b.listPatients(), []);
    assertEquals(await b.deleteReport(first.reportId), false);
  });

  test("clearAll removes reports but keeps settings", async (b) => {
    await b.updateSettings({ theme: "dark" });
    await b.importReports([{ name: "a.json", text: syntheticReport() }]);
    await b.clearAll();
    assertEquals(await b.listPatients(), []);
    assertEquals(await b.getSettings(), {
      theme: "dark",
      selectedPatientId: null,
      chartLibrary: "vega-lite",
      chartCurve: "straight",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
      notifyWhenRead: true,
    });
  });

  test("the selected patient is remembered in settings", async (b) => {
    assertEquals((await b.getSettings()).selectedPatientId, null);
    await b.updateSettings({ selectedPatientId: 7 });
    assertEquals(await b.getSettings(), {
      theme: "system",
      selectedPatientId: 7,
      chartLibrary: "vega-lite",
      chartCurve: "straight",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
      notifyWhenRead: true,
    });
    await b.updateSettings({ selectedPatientId: null });
    assertEquals((await b.getSettings()).selectedPatientId, null);
    await assertRejects(() =>
      b.updateSettings({ selectedPatientId: -2 } as never)
    );
  });

  test("settings round-trip and invalid values reject", async (b) => {
    assertEquals(await b.getSettings(), {
      theme: "system",
      selectedPatientId: null,
      chartLibrary: "vega-lite",
      chartCurve: "straight",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
      notifyWhenRead: true,
    });
    assertEquals(await b.updateSettings({ theme: "light" }), {
      theme: "light",
      selectedPatientId: null,
      chartLibrary: "vega-lite",
      chartCurve: "straight",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
      notifyWhenRead: true,
    });
    await assertRejects(() => b.updateSettings({ theme: "sepia" } as never));
    await assertRejects(() =>
      b.updateSettings({ chartLibrary: "d3" } as never)
    );
    assertEquals(await b.getSettings(), {
      theme: "light",
      selectedPatientId: null,
      chartLibrary: "vega-lite",
      chartCurve: "straight",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
      notifyWhenRead: true,
    });
  });
}

/** A PNG signature: enough for an upload to count as a photo. */
const PNG_BYTES = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);

/** Imports once none is waiting or reading. */
export async function settledImports(
  b: DesktopBindings,
): Promise<ImportJob[]> {
  for (let i = 0; i < 500; i++) {
    const jobs = await b.listImports();
    if (!jobs.some((j) => j.status === "waiting" || j.status === "reading")) {
      return jobs;
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("imports didn't settle");
}

/** Starts an import the way the page does: names and sizes, then the bytes as their own argument. */
function startWith(b: DesktopBindings, files: NamedBytes[]) {
  const packed = packFiles(files);
  return b.startImport(packed.files, packed.bytes);
}
