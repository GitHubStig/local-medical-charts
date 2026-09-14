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
import type { DesktopBindings } from "./contract.ts";
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
    const [outcome] = await b.startImports([{
      files: [{ name: "notes.txt", bytes: new TextEncoder().encode("hi") }],
    }]);
    assert(!outcome.ok);
    assertEquals(outcome.fileNames, ["notes.txt"]);
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
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
    });
  });

  test("the selected patient is remembered in settings", async (b) => {
    assertEquals((await b.getSettings()).selectedPatientId, null);
    await b.updateSettings({ selectedPatientId: 7 });
    assertEquals(await b.getSettings(), {
      theme: "system",
      selectedPatientId: 7,
      chartLibrary: "vega-lite",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
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
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
    });
    assertEquals(await b.updateSettings({ theme: "light" }), {
      theme: "light",
      selectedPatientId: null,
      chartLibrary: "vega-lite",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
    });
    await assertRejects(() => b.updateSettings({ theme: "sepia" } as never));
    await assertRejects(() =>
      b.updateSettings({ chartLibrary: "d3" } as never)
    );
    assertEquals(await b.getSettings(), {
      theme: "light",
      selectedPatientId: null,
      chartLibrary: "vega-lite",
      ollamaHost: "http://localhost:11434",
      ocrModel: null,
    });
  });
}
