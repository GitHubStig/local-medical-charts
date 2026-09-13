import { assertEquals, assertThrows } from "@std/assert";
import { type Catalog, indexCatalog } from "./catalog.ts";
import {
  migrate,
  type Migration,
  MigrationError,
  type ReportJson,
} from "./migrations/mod.ts";
import { buildReport } from "./normalize.ts";
import type { PageExtraction, Report } from "./schema.ts";
import { SCHEMA_VERSION } from "./schema.ts";
import { UpgradeError, upgradeReport } from "./upgrade.ts";

// All fixtures below are synthetic.

Deno.test("migrate leaves a current report alone", () => {
  const result = migrate({ schemaVersion: SCHEMA_VERSION, keep: true });
  assertEquals(result.from, SCHEMA_VERSION);
  assertEquals(result.applied, []);
  assertEquals(result.json.keep, true);
});

Deno.test("migrate rejects missing, invalid and newer versions", () => {
  assertThrows(() => migrate({}), MigrationError, "no schemaVersion");
  assertThrows(() => migrate({ schemaVersion: 0 }), MigrationError, "invalid");
  assertThrows(() => migrate([]), MigrationError, "expected a JSON object");
  assertThrows(
    () => migrate({ schemaVersion: SCHEMA_VERSION + 1 }),
    MigrationError,
    "newer than this code",
  );
});

const renameField: Migration = {
  from: 1,
  to: 2,
  description: "rename title to name",
  up: ({ title, ...rest }) => ({ ...rest, name: title, schemaVersion: 2 }),
};
const addFlag: Migration = {
  from: 2,
  to: 3,
  description: "add reviewed flag",
  up: (json) => ({ ...json, reviewed: false, schemaVersion: 3 }),
};

Deno.test("migrate runs each step in order", () => {
  const input: ReportJson = { schemaVersion: 1, title: "x" };
  const result = migrate(input, {
    migrations: [addFlag, renameField],
    target: 3,
  });
  assertEquals(result.json, { schemaVersion: 3, name: "x", reviewed: false });
  assertEquals(result.applied.map((m) => m.to), [2, 3]);
  assertEquals(input, { schemaVersion: 1, title: "x" }, "input untouched");
});

Deno.test("migrate rejects gaps, jumps and steps that forget the version", () => {
  assertThrows(
    () => migrate({ schemaVersion: 1 }, { migrations: [addFlag], target: 3 }),
    MigrationError,
    "no migration from schemaVersion 1",
  );
  assertThrows(
    () =>
      migrate({ schemaVersion: 1 }, {
        migrations: [{ ...renameField, to: 3 }],
        target: 3,
      }),
    MigrationError,
    "each step must move one version",
  );
  assertThrows(
    () =>
      migrate({ schemaVersion: 1 }, {
        migrations: [{ ...renameField, up: (json) => json }],
        target: 2,
      }),
    MigrationError,
    "did not set schemaVersion",
  );
});

const baseCatalog: Catalog = {
  analytes: [{
    id: "haemoglobin",
    name: "Haemoglobin",
    specimen: "blood",
    unit: "g/dL",
    aliases: ["Haemoglobin"],
    units: { "g/dL": 1, "g/L": 0.1 },
  }],
};
const oldCatalog = indexCatalog(baseCatalog, "catalog-old");
const newCatalog = indexCatalog({
  analytes: [
    ...baseCatalog.analytes,
    {
      id: "ferritin",
      name: "Ferritin",
      specimen: "blood",
      unit: "ng/mL",
      aliases: ["Serum Ferritin"],
      units: { "ng/mL": 1 },
    },
  ],
}, "catalog-new");

const extraction: PageExtraction = {
  page: 1,
  pageCount: 1,
  provider: { name: "Example Lab", address: null, phone: null, website: null },
  patient: {
    name: "TEST PATIENT",
    idNumber: "X0000000",
    dateOfBirth: "15/08/90",
    sex: "Female",
    age: "35",
  },
  doctor: { name: "DR EXAMPLE", clinic: null },
  dates: {
    collected: "14/01/25 08:30",
    received: null,
    requested: null,
    reported: null,
  },
  headerFields: [],
  tests: [
    {
      headings: [],
      specimen: "blood",
      name: "Haemoglobin",
      nameZh: null,
      measurements: [{
        value: "13.1",
        unit: "g/dL",
        referenceText: "(12.0-15.5)",
        marker: null,
      }],
      notes: [],
    },
    {
      headings: [],
      specimen: "blood",
      name: "Serum Ferritin",
      nameZh: null,
      measurements: [{
        value: "85",
        unit: "ng/mL",
        referenceText: "(15-150)",
        marker: null,
      }],
      notes: [],
    },
  ],
  continuationText: null,
  interpretation: [],
  specimenNotes: [],
  warnings: [],
};

function storedReport(): Report {
  return buildReport(
    [{
      image: "example-1.jpg",
      model: "test-model",
      promptHash: "test-prompt",
      extractedAt: "2025-01-15T10:00:00.000Z",
      extraction,
    }],
    {
      report: "example",
      catalogHash: oldCatalog.hash,
      mergedAt: "2025-01-15T11:00:00.000Z",
    },
    oldCatalog,
  );
}
const now = new Date("2026-01-01T00:00:00.000Z");

Deno.test("upgradeReport keeps a current report untouched", () => {
  const stored = storedReport();
  const result = upgradeReport(stored, oldCatalog, { now });
  assertEquals(result.changed, false);
  assertEquals(result.reasons, []);
  assertEquals(result.report, stored);
});

Deno.test("upgradeReport re-merges against a newer catalog without OCR", () => {
  const stored = storedReport();
  assertEquals(stored.unmapped.map((u) => u.name), ["Serum Ferritin"]);

  const result = upgradeReport(stored, newCatalog, { now });
  assertEquals(result.reasons, ["catalog changed"]);
  assertEquals(result.report.unmapped, []);
  assertEquals(
    result.report.tests.find((t) => t.name === "Serum Ferritin")?.analyte,
    "ferritin",
  );
  assertEquals(result.report.source.catalogHash, "catalog-new");
  assertEquals(result.report.source.mergedAt, now.toISOString());
  assertEquals(result.report.pages, stored.pages, "pages carried over as-is");
});

Deno.test("upgradeReport re-merges when forced or when derived data is broken", () => {
  assertEquals(
    upgradeReport(storedReport(), oldCatalog, { now, force: true }).reasons,
    ["forced"],
  );

  const broken = { ...storedReport(), tests: "not a list" };
  const repaired = upgradeReport(broken, oldCatalog, { now });
  assertEquals(repaired.reasons, ["repaired"]);
  assertEquals(repaired.report.tests.length, 2);
});

Deno.test("upgradeReport rejects a report from a newer version of the app", () => {
  assertThrows(
    () =>
      upgradeReport(
        { ...storedReport(), schemaVersion: SCHEMA_VERSION + 1 },
        oldCatalog,
        { now },
      ),
    MigrationError,
    "newer than this code",
  );
});

// There is no version before 1, so a migration can't run end to end through
// upgradeReport yet. The first real migration (1 → 2) should add a test here that
// upgrades a synthetic version-1 report and checks it re-merges.

Deno.test("upgradeReport refuses a report it cannot rebuild", () => {
  const { pages: _, ...noPages } = storedReport();
  assertThrows(
    () => upgradeReport({ ...noPages, tests: null }, oldCatalog, { now }),
    UpgradeError,
    "cannot re-merge",
  );
});
