import { assert, assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_VERSION } from "../../src/schema.ts";
import { patientIdentity, ReportStore, StoreError } from "./store.ts";
import { catalogV1, catalogV2, syntheticReport } from "./testing.ts";

// All reports here are synthetic (see testing.ts).

const now = new Date("2026-01-01T00:00:00.000Z");

function withStore(fn: (store: ReportStore) => void) {
  const store = ReportStore.open(":memory:");
  try {
    fn(store);
  } finally {
    store.close();
  }
}

Deno.test("addReport files a report under its patient and indexes its results", () => {
  withStore((store) => {
    const added = store.addReport(
      syntheticReport(),
      "jan.json",
      catalogV1,
      now,
    );
    assertEquals(added.status, "added");

    const [patient] = store.listPatients();
    assertEquals(patient.name, "ALEX EXAMPLE");
    assertEquals(patient.dateOfBirth, "1990-08-15");
    assertEquals(patient.reportCount, 1);
    assertEquals(patient.lastCollectedAt, "2025-01-14T08:30:00");

    const results = store.resultsForPatient(patient.id);
    assertEquals(
      results.map((r) => r.analyte ?? "(unmapped)").sort(),
      ["(unmapped)", "glucose", "haemoglobin"],
    );
    const hb = results.find((r) => r.analyte === "haemoglobin")!;
    assertEquals([hb.value, hb.standardValue, hb.standardUnit], [
      13.1,
      13.1,
      "g/dL",
    ]);
    assertEquals(hb.range, { kind: "between", min: 12, max: 15.5 });

    const report = store.getReport(added.reportId)!;
    assertEquals(report.schemaVersion, SCHEMA_VERSION);
  });
});

Deno.test("the same report uploaded twice is stored once", () => {
  withStore((store) => {
    const text = syntheticReport();
    const first = store.addReport(text, "jan.json", catalogV1, now);
    // Same content, different formatting and file name.
    const again = store.addReport(
      JSON.stringify(JSON.parse(text)),
      "copy.json",
      catalogV1,
      now,
    );
    assertEquals(again, { ...first, status: "duplicate" });
    assertEquals(store.listReports(first.patientId).length, 1);
  });
});

Deno.test("reports group by ID number, ignoring spacing and case", () => {
  withStore((store) => {
    const a = store.addReport(
      syntheticReport({ idNumber: "X1234567" }),
      "a.json",
      catalogV1,
      now,
    );
    const b = store.addReport(
      syntheticReport({
        idNumber: "x-1234 567",
        collected: "20/06/25 09:00",
        haemoglobin: "12.8",
      }),
      "b.json",
      catalogV1,
      now,
    );
    const c = store.addReport(
      syntheticReport({ idNumber: "Y7654321", patientName: "SAM EXAMPLE" }),
      "c.json",
      catalogV1,
      now,
    );

    assertEquals(a.patientId, b.patientId);
    assert(a.patientId !== c.patientId);
    assertEquals(store.listPatients().map((p) => [p.name, p.reportCount]), [
      ["ALEX EXAMPLE", 2],
      ["SAM EXAMPLE", 1],
    ]);
    const hb = store.resultsForPatient(a.patientId).filter((r) =>
      r.analyte === "haemoglobin"
    );
    assertEquals(hb.map((r) => [r.collectedAt, r.value]), [
      ["2025-01-14T08:30:00", 13.1],
      ["2025-06-20T09:00:00", 12.8],
    ]);
  });
});

Deno.test("without an ID number, name and date of birth identify the patient", () => {
  assertEquals(
    patientIdentity(
      {
        name: "alex  example",
        idNumber: null,
        dateOfBirthIso: "1990-08-15",
      } as never,
    ),
    "name:ALEX EXAMPLE|1990-08-15",
  );
  withStore((store) => {
    assertThrows(
      () =>
        store.addReport(
          syntheticReport({ idNumber: null, dateOfBirth: null }),
          "anon.json",
          catalogV1,
          now,
        ),
      StoreError,
      "no patient ID number",
    );
    assertEquals(store.listPatients(), []);
  });
});

Deno.test("invalid uploads throw and store nothing", () => {
  withStore((store) => {
    assertThrows(
      () => store.addReport("{ not json", "bad.json", catalogV1, now),
      StoreError,
      "not valid JSON",
    );
    assertThrows(
      () => store.addReport('{"hello": 1}', "other.json", catalogV1, now),
      StoreError,
      "no schemaVersion",
    );
    const future = JSON.stringify({
      ...JSON.parse(syntheticReport()),
      schemaVersion: SCHEMA_VERSION + 1,
    });
    assertThrows(
      () => store.addReport(future, "future.json", catalogV1, now),
      StoreError,
      "newer than this code",
    );
    assertEquals(store.listPatients(), []);
  });
});

Deno.test("the original upload is kept byte for byte", () => {
  withStore((store) => {
    // Merged with catalogV1 but imported under catalogV2, so the stored report differs from the upload.
    const text = syntheticReport({}, catalogV1);
    const { reportId } = store.addReport(text, "jan.json", catalogV2, now);
    assertEquals(store.getReport(reportId)!.source.catalogHash, "catalog-v2");
    assertEquals(store.getOriginalJson(reportId), text);
  });
});

Deno.test("upgradeAll re-merges out-of-date reports from their originals", () => {
  withStore((store) => {
    const { reportId, patientId } = store.addReport(
      syntheticReport(),
      "jan.json",
      catalogV1,
      now,
    );
    const unmapped = () =>
      store.resultsForPatient(patientId).filter((r) => r.analyte === null)
        .length;
    assertEquals(unmapped(), 1);

    assertEquals(store.upgradeAll(catalogV1, now), {
      checked: 1,
      upgraded: 0,
      failed: [],
    });

    const summary = store.upgradeAll(catalogV2, now);
    assertEquals(summary, { checked: 1, upgraded: 1, failed: [] });
    assertEquals(unmapped(), 0);
    assertEquals(store.listReports(patientId)[0].catalogHash, "catalog-v2");
    assertEquals(
      store.resultsForPatient(patientId).find((r) =>
        r.name === "Serum Ferritin"
      )?.analyte,
      "ferritin",
    );
    assertEquals(store.getReport(reportId)!.unmapped, []);
  });
});

Deno.test("a report that fails to upgrade is kept, marked failed, and retried later", () => {
  const dir = Deno.makeTempDirSync();
  const path = join(dir, "store.db");
  try {
    let store = ReportStore.open(path);
    const { reportId, patientId } = store.addReport(
      syntheticReport(),
      "jan.json",
      catalogV1,
      now,
    );
    store.close();

    // Simulate an upgrade that can't handle this original.
    const raw = new DatabaseSync(path);
    raw.prepare("UPDATE reports SET original_json = ? WHERE id = ?").run(
      '{"schemaVersion": 99}',
      reportId,
    );
    raw.close();

    store = ReportStore.open(path);
    const summary = store.upgradeAll(catalogV2, now);
    assertEquals(summary.upgraded, 0);
    assertEquals(summary.failed.map((f) => f.fileName), ["jan.json"]);
    const [report] = store.listReports(patientId);
    assertEquals(report.status, "failed");
    assert(report.error?.includes("newer than this code"));
    assertEquals(store.getReport(reportId), null);
    assertEquals(store.resultsForPatient(patientId), []);
    assertEquals(store.listPatients()[0].failedReportCount, 1);

    // Retried on the next launch even though the catalog hasn't changed again.
    assertEquals(store.upgradeAll(catalogV2, now).failed.length, 1);
    store.close();
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("data persists across reopening the database", () => {
  const dir = Deno.makeTempDirSync();
  const path = join(dir, "nested", "store.db");
  try {
    const store = ReportStore.open(path);
    store.addReport(syntheticReport(), "jan.json", catalogV1, now);
    store.close();

    const reopened = ReportStore.open(path);
    assertEquals(reopened.listPatients().map((p) => p.reportCount), [1]);
    reopened.close();
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("deleting a patient's last report removes the patient", () => {
  withStore((store) => {
    const a = store.addReport(syntheticReport(), "a.json", catalogV1, now);
    const b = store.addReport(
      syntheticReport({ collected: "20/06/25 09:00", haemoglobin: "12.8" }),
      "b.json",
      catalogV1,
      now,
    );
    assert(store.deleteReport(a.reportId, now));
    assertEquals(store.listPatients().map((p) => p.reportCount), [1]);
    assertEquals(
      store.resultsForPatient(b.patientId).every((r) =>
        r.reportId === b.reportId
      ),
      true,
    );
    assert(store.deleteReport(b.reportId, now));
    assertEquals(store.listPatients(), []);
    assertEquals(store.deleteReport(b.reportId, now), false);
  });
});

Deno.test("clearAll removes everything", () => {
  withStore((store) => {
    const { patientId } = store.addReport(
      syntheticReport(),
      "a.json",
      catalogV1,
      now,
    );
    store.clearAll();
    assertEquals(store.listPatients(), []);
    assertEquals(store.resultsForPatient(patientId), []);
  });
});

Deno.test("settings default, persist across reopening, and survive clearAll", () => {
  const dir = Deno.makeTempDirSync();
  const path = join(dir, "store.db");
  try {
    let store = ReportStore.open(path);
    assertEquals(store.getSettings(), { theme: "system" });
    assertEquals(store.updateSettings({ theme: "dark" }, now), {
      theme: "dark",
    });
    store.addReport(syntheticReport(), "a.json", catalogV1, now);
    store.clearAll();
    store.close();

    store = ReportStore.open(path);
    assertEquals(store.getSettings(), { theme: "dark" });
    assertEquals(store.listPatients(), []);
    store.close();
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
