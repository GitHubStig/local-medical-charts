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
    assertEquals(await b.getSettings(), { theme: "dark" });
  });

  test("settings round-trip and invalid values reject", async (b) => {
    assertEquals(await b.getSettings(), { theme: "system" });
    assertEquals(await b.updateSettings({ theme: "light" }), {
      theme: "light",
    });
    await assertRejects(() => b.updateSettings({ theme: "sepia" } as never));
    assertEquals(await b.getSettings(), { theme: "light" });
  });
}
