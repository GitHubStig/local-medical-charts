import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  BindingError,
  createBindings,
  unavailableBindings,
} from "./bindings.ts";
import type { StartupStatus } from "./contract.ts";
import { defineContractTests } from "./contract_suite.ts";
import { ReportStore } from "./store/store.ts";
import { catalogV1 } from "./store/testing.ts";

// All reports here are synthetic (see store/testing.ts).

const startup: StartupStatus = {
  ok: true,
  databasePath: ":memory:",
  schemaVersion: 1,
  catalogHash: catalogV1.hash,
  upgrade: { checked: 0, upgraded: 0, failed: [] },
};
const now = () => new Date("2026-01-01T00:00:00.000Z");

function realBindings() {
  const store = ReportStore.open(":memory:");
  return {
    bindings: createBindings({ store, catalog: catalogV1, startup, now }),
    close: () => store.close(),
  };
}

defineContractTests("real bindings", realBindings);

Deno.test("real bindings: arguments from the page are checked", async () => {
  const { bindings: b, close } = realBindings();
  try {
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
  } finally {
    close();
  }
});

Deno.test("real bindings: rejected imports explain why", async () => {
  const { bindings: b, close } = realBindings();
  try {
    const [outcome] = await b.importReports([{
      name: "broken.json",
      text: "{ nope",
    }]);
    assert(
      outcome.status === "rejected" && outcome.error.includes("not valid JSON"),
    );
  } finally {
    close();
  }
});

Deno.test("with the database unavailable, status explains, settings default, the rest reject", async () => {
  const b = unavailableBindings({
    ok: false,
    databasePath: "/somewhere/medical-charts.db",
    error: "the database is version 9, newer than this app supports (1)",
  });
  const status = await b.getStartupStatus();
  assert(!status.ok && status.error.includes("newer than this app"));
  assertEquals(await b.getSettings(), {
    theme: "system",
    selectedPatientId: null,
    chartLibrary: "vega-lite",
  });
  await assertRejects(
    () => b.listPatients(),
    BindingError,
    "database is unavailable",
  );
  await assertRejects(
    () => b.updateSettings({ theme: "dark" }),
    BindingError,
    "unavailable",
  );
});
