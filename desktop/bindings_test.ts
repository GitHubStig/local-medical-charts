import { assert, assertEquals, assertRejects } from "@std/assert";
import { SettingsError } from "./settings.ts";
import {
  BindingError,
  createBindings,
  unavailableBindings,
} from "./bindings.ts";
import type { StartupStatus } from "./contract.ts";
import { ReportStore } from "./store/store.ts";
import { catalogV1, syntheticReport } from "./store/testing.ts";

// All reports here are synthetic (see store/testing.ts).

const startup: StartupStatus = {
  ok: true,
  databasePath: ":memory:",
  schemaVersion: 1,
  catalogHash: catalogV1.hash,
  upgrade: { checked: 0, upgraded: 0, failed: [] },
};
const now = () => new Date("2026-01-01T00:00:00.000Z");

async function withBindings(
  fn: (b: ReturnType<typeof createBindings>) => Promise<void>,
) {
  const store = ReportStore.open(":memory:");
  try {
    await fn(createBindings({ store, catalog: catalogV1, startup, now }));
  } finally {
    store.close();
  }
}

Deno.test("importReports gives each file its own outcome", () =>
  withBindings(async (b) => {
    const text = syntheticReport();
    const outcomes = await b.importReports([
      { name: "jan.json", text },
      { name: "again.json", text },
      { name: "broken.json", text: "{ nope" },
    ]);
    assertEquals(outcomes.map((o) => [o.fileName, o.status]), [
      ["jan.json", "added"],
      ["again.json", "duplicate"],
      ["broken.json", "rejected"],
    ]);
    const rejected = outcomes[2];
    assert(
      rejected.status === "rejected" &&
        rejected.error.includes("not valid JSON"),
    );
  }));

Deno.test("getDashboard returns the patient, reports without OCR pages, and results", () =>
  withBindings(async (b) => {
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
    assertEquals("pages" in dashboard.reports[0].report!, false);
    assertEquals(
      dashboard.results.filter((r) => r.analyte === "haemoglobin").map((r) =>
        r.value
      ),
      [13.1, 12.8],
    );
    // Everything must survive the JSON boundary unchanged.
    assertEquals(JSON.parse(JSON.stringify(dashboard)), dashboard);
  }));

Deno.test("getDashboard returns null for an unknown patient", () =>
  withBindings(async (b) => {
    assertEquals(await b.getDashboard(999), null);
  }));

Deno.test("deleteReport and clearAll change what the page sees", () =>
  withBindings(async (b) => {
    const [added] = await b.importReports([{
      name: "jan.json",
      text: syntheticReport(),
    }]);
    assert(added.status === "added");
    assertEquals(await b.deleteReport(added.reportId), true);
    assertEquals(await b.listPatients(), []);

    await b.importReports([{ name: "jan.json", text: syntheticReport() }]);
    await b.clearAll();
    assertEquals(await b.listPatients(), []);
  }));

Deno.test("arguments from the page are checked", () =>
  withBindings(async (b) => {
    await assertRejects(
      () => b.getDashboard("1" as never),
      BindingError,
      "positive integer",
    );
    await assertRejects(
      () => b.deleteReport(0),
      BindingError,
      "positive integer",
    );
    await assertRejects(
      () => b.importReports([{ name: "x.json" }] as never),
      BindingError,
      "{ name, text }",
    );
  }));

Deno.test("when the database can't open, status explains and everything else rejects", async () => {
  const b = unavailableBindings({
    ok: false,
    databasePath: "/somewhere/medical-charts.db",
    error: "the database is version 9, newer than this app supports (1)",
  });
  const status = await b.getStartupStatus();
  assert(!status.ok && status.error.includes("newer than this app"));
  await assertRejects(
    () => b.listPatients(),
    BindingError,
    "database is unavailable",
  );
});

Deno.test("settings round-trip and invalid values reject", () =>
  withBindings(async (b) => {
    assertEquals(await b.getSettings(), { theme: "system" });
    assertEquals(await b.updateSettings({ theme: "light" }), {
      theme: "light",
    });
    assertEquals(await b.getSettings(), { theme: "light" });
    await assertRejects(
      () => b.updateSettings({ theme: "sepia" } as never),
      SettingsError,
      "theme must be one of",
    );
    assertEquals(await b.getSettings(), { theme: "light" });
  }));

Deno.test("with the database unavailable, settings fall back to defaults", async () => {
  const b = unavailableBindings({
    ok: false,
    databasePath: "/somewhere/medical-charts.db",
    error: "disk full",
  });
  assertEquals(await b.getSettings(), { theme: "system" });
  await assertRejects(
    () => b.updateSettings({ theme: "dark" }),
    BindingError,
    "unavailable",
  );
});
