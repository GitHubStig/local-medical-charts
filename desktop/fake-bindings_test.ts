import { assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { defineContractTests } from "./contract_suite.ts";

defineContractTests(
  "fake bindings",
  () => ({ bindings: createFakeBindings() }),
);

Deno.test("fake bindings: the sample reports load as two fictional patients", async () => {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  assertEquals(
    (await b.listPatients()).map((p) => [p.name, p.reportCount]),
    [["ALEX TAN", 4], ["SAM RIVERA", 1]],
  );
});

Deno.test("fake bindings: every file in samples/ is loaded", () => {
  const onDisk = [...Deno.readDirSync(new URL("../samples", import.meta.url))]
    .filter((e) => e.name.endsWith(".json"))
    .map((e) => e.name)
    .sort();
  assertEquals(SAMPLE_REPORTS.map((r) => r.name).sort(), onDisk);
});

Deno.test("fake bindings: settings persist in the storage they're given", async () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => void saved.set(key, value),
  };
  await createFakeBindings({ storage }).updateSettings({ theme: "dark" });
  assertEquals(await createFakeBindings({ storage }).getSettings(), {
    theme: "dark",
    selectedPatientId: null,
  });
});
