import { assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { buildTestGrid, filterTestGrid } from "../app/src/lib/test-grid.ts";
import type { Dashboard } from "./contract.ts";

// Uses the fictional sample reports (samples/).

async function alexDashboard(): Promise<Dashboard> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const alex = (await b.listPatients()).find((p) => p.name === "ALEX TAN")!;
  return (await b.getDashboard(alex.id))!;
}

const card = (grid: ReturnType<typeof buildTestGrid>, key: string) =>
  grid.groups.flatMap((g) => g.cards).find((c) => c.key === key)!;

Deno.test("tests are grouped in catalog order, with word-only results left out", async () => {
  const grid = buildTestGrid(await alexDashboard());
  assertEquals(
    grid.groups.map((g) => [g.name, g.cards.map((c) => c.key)]),
    [
      ["Full blood count", [
        "wbc",
        "neutrophils_pct",
        "neutrophils_abs",
        "haemoglobin",
        "platelets",
      ]],
      ["Lipids", ["total_cholesterol", "triglycerides", "hdl_c", "ldl_c"]],
      ["Renal & electrolytes", ["creatinine", "egfr", "urea", "potassium"]],
      ["Diabetes", ["glucose", "hba1c", "hba1c_ifcc"]],
      ["Liver", ["alt", "ggt"]],
      ["Thyroid", ["tsh", "free_t4"]],
    ],
  );
  assertEquals(grid.textOnlyCount, 6);
});

Deno.test("cards show catalog names and values in standard units, with the lab range converted", async () => {
  const grid = buildTestGrid(await alexDashboard());
  const hb = card(grid, "haemoglobin");
  // The latest Harbour report printed 122 g/L with a (120-155) range.
  assertEquals([hb.name, hb.unit, hb.latest.display, hb.range], [
    "Haemoglobin",
    "g/dL",
    "12.2",
    "12 – 15.5",
  ]);
  assertEquals([hb.change, hb.readingCount, hb.span], [
    "+0.6 since Oct 2025",
    4,
    "Nov 2024 – Mar 2026",
  ]);

  const wbc = card(grid, "wbc");
  assertEquals(wbc.name, "White cell count");
});

Deno.test("flags come from the latest reading; comparators don't produce a change", async () => {
  const grid = buildTestGrid(await alexDashboard());
  const alt = card(grid, "alt");
  assertEquals([alt.latest.display, alt.latest.flag, alt.change, alt.range], [
    "47",
    "H",
    "+16 since Oct 2025",
    "< 35",
  ]);
  assertEquals(card(grid, "egfr").change, "+3 since Oct 2025");
  assertEquals(grid.groups.map((g) => g.flagged), [0, 2, 0, 0, 1, 0]);
});

Deno.test("search matches names, printed names and groups; flagged-only keeps flagged cards", async () => {
  const { groups } = buildTestGrid(await alexDashboard());
  const keys = (query: string, flaggedOnly = false) =>
    filterTestGrid(groups, { query, flaggedOnly }).flatMap((g) =>
      g.cards.map((c) => c.key)
    );

  assertEquals(keys("chol"), ["total_cholesterol", "hdl_c", "ldl_c"]);
  assertEquals(keys("total wbc"), ["wbc"], "matches the name one lab printed");
  assertEquals(keys("LIVER"), ["alt", "ggt"]);
  assertEquals(keys("", true), ["total_cholesterol", "ldl_c", "alt"]);
  assertEquals(keys("chol", true), ["total_cholesterol", "ldl_c"]);
  assertEquals(keys("nothing like this"), []);
});

Deno.test("tests the catalog doesn't know get their own group, by printed name", () => {
  const dashboard = {
    patient: {} as Dashboard["patient"],
    reports: [],
    results: [{
      reportId: 1,
      position: 0,
      analyte: null,
      specimen: "blood",
      name: "Mystery Marker",
      collectedAt: "2025-01-14T08:30:00",
      resultKind: "numeric",
      value: 4.2,
      op: null,
      text: null,
      unit: "mmol/L",
      standardValue: null,
      standardOp: null,
      standardUnit: null,
      range: { kind: "between", min: 1, max: 5 },
      flag: null,
      flagSource: null,
      page: 1,
    }],
  } satisfies Dashboard;
  const { groups } = buildTestGrid(dashboard);
  assertEquals(groups.map((g) => g.name), ["Not in the catalog"]);
  assertEquals(
    [
      groups[0].cards[0].name,
      groups[0].cards[0].unit,
      groups[0].cards[0].latest.display,
      groups[0].cards[0].range,
    ],
    ["Mystery Marker", "mmol/L", "4.2", "1 – 5"],
  );
});

Deno.test("with a single report, cards say a trend needs another report and show the reading's date", async () => {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const sam = (await b.listPatients()).find((p) => p.name === "SAM RIVERA")!;
  const hb = card(
    buildTestGrid((await b.getDashboard(sam.id))!),
    "haemoglobin",
  );
  assertEquals([hb.change, hb.note, hb.span], [
    null,
    "1 result — add another report to see a trend",
    "7 Aug 2026",
  ]);

  // With several reports, the note is the change.
  const alex = card(buildTestGrid(await alexDashboard()), "haemoglobin");
  assertEquals(alex.note, "+0.6 since Oct 2025");
});
