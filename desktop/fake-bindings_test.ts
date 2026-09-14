import { assert, assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { defineContractTests } from "./contract_suite.ts";

defineContractTests(
  "fake bindings",
  () => ({
    bindings: createFakeBindings({
      pageMs: 0,
      now: () => new Date("2026-05-11T09:00:00.000Z"),
    }),
  }),
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
    chartLibrary: "vega-lite",
    ollamaHost: "http://localhost:11434",
    ocrModel: null,
  });
});

Deno.test("fake bindings: OCR setup answers from a fictional model list, with the real wording", async () => {
  const b = createFakeBindings();
  const list = await b.listOcrModels();
  assert(list.ok);
  assertEquals(
    list.models.filter((m) => m.readsImages).map((m) => m.name),
    ["gemma3:27b", "qwen3.8:27b-mlx"],
  );

  const noModel = await b.testOcr();
  assertEquals(
    [noModel.ok, noModel.checks.at(-1)?.message],
    [false, "Choose a model first."],
  );

  await b.updateSettings({ ocrModel: "llama3.3:70b" });
  assertEquals(
    (await b.testOcr()).checks.at(-1)?.message,
    "llama3.3:70b can't read images. Choose a model marked “Reads images”.",
  );

  await b.updateSettings({ ocrModel: "qwen3.8:27b-mlx" });
  const passed = await b.testOcr();
  assertEquals(passed.ok, true);
  assertEquals(passed.checks.map((c) => c.step), [
    "reachable",
    "installed",
    "reads-images",
  ]);
});
