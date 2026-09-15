import { assert, assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { buildTestGrid, filterTestGrid } from "../app/src/lib/test-grid.ts";
import { buildTestTable } from "../app/src/lib/test-table.ts";
import type { Dashboard } from "./contract.ts";

// Uses the fictional sample reports (samples/).

async function sampleDashboard(name: string): Promise<Dashboard> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const patient = (await b.listPatients()).find((p) => p.name === name)!;
  return (await b.getDashboard(patient.id))!;
}

Deno.test("the table has a column per report, oldest first, and the grid's groups and tests", async () => {
  const dashboard = await sampleDashboard("ALEX TAN");
  const { groups } = buildTestGrid(dashboard);
  const table = buildTestTable(dashboard, groups);
  assertEquals(table.columns.map((c) => [c.date, c.lab]), [
    ["12 Nov 2024", "Northside Pathology"],
    ["20 May 2025", "Northside Pathology"],
    ["3 Oct 2025", "Harbour Medical Lab"],
    ["18 Mar 2026", "Harbour Medical Lab"],
  ]);
  assertEquals(
    table.groups.map((g) => [g.name, g.rows.map((r) => r.key)]),
    groups.map((g) => [g.name, g.cards.map((c) => c.key)]),
  );
});

Deno.test("each cell shows the result in the row's unit, its flag, and that report's own lab range", async () => {
  const dashboard = await sampleDashboard("ALEX TAN");
  const table = buildTestTable(dashboard, buildTestGrid(dashboard).groups);
  const row = (key: string) =>
    table.groups.flatMap((g) => g.rows).find((r) => r.key === key)!;

  // Harbour prints haemoglobin in g/L against (120-155); the row reads g/dL.
  assertEquals(
    row("haemoglobin").cells.map((c) => c && [c.text, c.flag, c.range]),
    [
      ["12.5", null, "11.5 – 16"],
      ["12.2", null, "11.5 – 16"],
      ["11.7", "L", "12 – 15.5"],
      ["12.5", null, "12 – 15.5"],
    ],
  );
  assertEquals(row("alt").cells.map((c) => c?.text), ["< 7", "17", "33", "48"]);
  // Only Harbour prints HbA1c in mmol/mol.
  assertEquals(row("hba1c_ifcc").cells.map((c) => c?.text ?? null), [
    null,
    null,
    "42",
    "42",
  ]);
});

Deno.test("the table follows the Tests filters", async () => {
  const dashboard = await sampleDashboard("ALEX TAN");
  const shown = filterTestGrid(buildTestGrid(dashboard).groups, {
    query: "chol",
    flaggedOnly: false,
  });
  const table = buildTestTable(dashboard, shown);
  assertEquals(table.groups.map((g) => g.name), ["Lipids"]);
  assert(table.groups[0].rows.every((r) => /cholesterol/i.test(r.name)));
  assertEquals(table.columns.length, 4);
});

Deno.test("flagged only keeps a test flagged in any report, not just the latest", async () => {
  const dashboard = await sampleDashboard("ALEX TAN");
  const table = buildTestTable(dashboard, buildTestGrid(dashboard).groups, {
    flaggedOnly: true,
  });
  // Haemoglobin and potassium were flagged in October 2025 only.
  assertEquals(
    table.groups.map((g) => [g.name, g.rows.map((r) => r.name)]),
    [
      ["Full blood count", ["Haemoglobin"]],
      ["Lipids", ["Total cholesterol", "LDL cholesterol"]],
      ["Renal & electrolytes", ["Potassium"]],
      ["Liver", ["ALT"]],
    ],
  );
});
