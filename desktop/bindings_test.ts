import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  BindingError,
  createBindings,
  unavailableBindings,
} from "./bindings.ts";
import type { DesktopBindings, ImportJob, StartupStatus } from "./contract.ts";
import type { ReadingNotice } from "./imports/notice.ts";
import type { PageReader } from "./imports/reader.ts";
import type { OllamaService } from "./ocr/ollama.ts";
import { packFiles } from "./imports/packed-files.ts";
import { simplePdf } from "./ocr/simple-pdf.ts";
import { defineContractTests } from "./contract_suite.ts";
import { ReportStore } from "./store/store.ts";
import { catalogV1, syntheticExtraction } from "./store/testing.ts";

// All reports here are synthetic (see store/testing.ts).

const startup: StartupStatus = {
  ok: true,
  databasePath: ":memory:",
  schemaVersion: 1,
  catalogHash: catalogV1.hash,
  upgrade: { checked: 0, upgraded: 0, failed: [] },
};
const now = () => new Date("2026-01-01T00:00:00.000Z");

/** Records what the bindings ask Ollama; never touches the network. */
function recordingOllama(calls: unknown[] = []): OllamaService {
  return {
    listModels: (host) => {
      calls.push(["listModels", host]);
      return Promise.resolve({ ok: false, host, error: "stand-in" });
    },
    test: (host, model) => {
      calls.push(["test", host, model]);
      return Promise.resolve({ host, model, ok: false, checks: [] });
    },
  };
}

/** Reads every page as the same made-up page, recording the settings it was opened with. */
function standInPageReader(opened: string[] = []) {
  return (host: string, model: string): Promise<PageReader> => {
    opened.push(`${host} ${model}`);
    return Promise.resolve({
      model,
      promptHash: "prompt-1",
      read: (_image, page, pageCount) =>
        Promise.resolve(syntheticExtraction({ page, pageCount })),
    });
  };
}

function realBindings(
  { ollama = recordingOllama(), pageReader = standInPageReader(), notify }: {
    ollama?: OllamaService;
    pageReader?: (host: string, model: string) => Promise<PageReader>;
    notify?: (notice: ReadingNotice) => void;
  } = {},
) {
  const store = ReportStore.open(":memory:");
  return {
    bindings: createBindings({
      store,
      catalog: catalogV1,
      startup,
      ollama,
      pageReader,
      notify,
      now,
    }),
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
    chartCurve: "smooth",
    chartTheme: "app",
    ollamaHost: "http://localhost:11434",
    ocrModel: null,
    notifyWhenRead: true,
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

Deno.test("real bindings: OCR checks use the saved Ollama address and model", async () => {
  const calls: unknown[] = [];
  const { bindings: b, close } = realBindings({
    ollama: recordingOllama(calls),
  });
  try {
    await b.listOcrModels();
    await b.testOcr();
    await b.updateSettings({
      ollamaHost: "http://192.168.1.20:11434/",
      ocrModel: "qwen3.8:27b-mlx",
    });
    await b.testOcr();
    assertEquals(calls, [
      ["listModels", "http://localhost:11434"],
      ["test", "http://localhost:11434", null],
      ["test", "http://192.168.1.20:11434", "qwen3.8:27b-mlx"],
    ]);
  } finally {
    close();
  }
});

/** Imports once none is waiting or reading. */
async function settledImports(b: DesktopBindings): Promise<ImportJob[]> {
  for (let i = 0; i < 500; i++) {
    const jobs = await b.listImports();
    if (!jobs.some((j) => j.status === "waiting" || j.status === "reading")) {
      return jobs;
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("imports didn't settle");
}

const examplePdf = () =>
  simplePdf([
    ["EXAMPLE LAB", "HAEMOGLOBIN   13.1   g/dL"],
    ["EXAMPLE LAB", "GLUCOSE   5.2   mmol/L"],
  ]);

Deno.test("real bindings: a PDF is read with the saved model, reviewed, then saved", async () => {
  const opened: string[] = [];
  const { bindings: b, close } = realBindings({
    pageReader: standInPageReader(opened),
  });
  try {
    await b.updateSettings({ ocrModel: "vision:27b" });
    const pdf = packFiles([{ name: "example-lab.pdf", bytes: examplePdf() }]);
    const start = await b.startImport(pdf.files, pdf.bytes);
    assert(start.ok);

    const [job] = await settledImports(b);
    assertEquals(
      [job.status, job.source, job.pageCount, job.resultCount],
      ["ready", "pdf", 2, 6],
    );
    assertEquals(opened, ["http://localhost:11434 vision:27b"]);

    const review = await b.getImportReview(job.id);
    assertEquals(review?.report.patient.name, "ALEX EXAMPLE");
    assert(
      review && !("pages" in review.report),
      "page transcriptions stay behind",
    );
    const page = await b.getImportPage(job.id, 2);
    assertEquals(page?.name, "example-lab-2.png");
    assertEquals(page?.type, "image/png");

    const saved = await b.saveImport(job.id);
    assert(saved.status === "added");
    assertEquals(saved.fileName, "example-lab.pdf");
    assertEquals(await b.listImports(), [], "its files are forgotten");
    const dashboard = await b.getDashboard(saved.patientId);
    assertEquals(dashboard?.results.length, 6);
    assertEquals(dashboard?.reports[0].report?.source.images, [
      "example-lab-1.png",
      "example-lab-2.png",
    ]);
  } finally {
    close();
  }
});

// The failure itself is in the contract suite; only the real bindings open readers.
Deno.test("real bindings: without a model, no page reader is opened", async () => {
  const opened: string[] = [];
  const { bindings: b, close } = realBindings({
    pageReader: standInPageReader(opened),
  });
  try {
    const pdf = packFiles([{ name: "example-lab.pdf", bytes: examplePdf() }]);
    await b.startImport(pdf.files, pdf.bytes);
    const [job] = await settledImports(b);
    assertEquals(job.status, "failed");
    assertEquals(opened, []);
  } finally {
    close();
  }
});

Deno.test("real bindings: uploads are checked, and files that can't be read are refused in words", async () => {
  const { bindings: b, close } = realBindings();
  try {
    const notes = packFiles([
      { name: "notes.txt", bytes: new TextEncoder().encode("hi") },
    ]);
    const refused = await b.startImport(notes.files, notes.bytes);
    assert(
      !refused.ok &&
        refused.error === "notes.txt isn't a PDF, JPG, PNG or WebP file.",
    );

    // What a Uint8Array nested inside an object arrives as from the desktop page.
    await assertRejects(
      () =>
        b.startImport(
          [{ name: "a.pdf", size: 3 }],
          { 0: 37, 1: 80, 2: 68 } as never,
        ),
      BindingError,
      "bytes must be a Uint8Array",
    );
    await assertRejects(
      () => b.startImport([{ name: "a.pdf" }] as never, new Uint8Array(3)),
      BindingError,
      "{ name, size }",
    );
    await assertRejects(
      () => b.startImport([{ name: "a.pdf", size: 5 }], new Uint8Array(3)),
      BindingError,
      "add up to 5 bytes",
    );
    await assertRejects(
      () => b.getImportPage(1, 0),
      BindingError,
      "page must be a positive integer",
    );
  } finally {
    close();
  }
});

Deno.test("real bindings: a finished reading is announced only while the setting is on", async () => {
  const notices: ReadingNotice[] = [];
  const { bindings: b, close } = realBindings({
    notify: (notice) => notices.push(notice),
  });
  try {
    await b.updateSettings({ ocrModel: "vision:27b" });
    const pdf = packFiles([{ name: "example-lab.pdf", bytes: examplePdf() }]);
    assert((await b.startImport(pdf.files, pdf.bytes)).ok);
    const [job] = await settledImports(b);
    assertEquals(notices, [{
      title: "Report ready to review",
      body: "2 pages read. Check the results before saving.",
      tag: `medical-charts-import-${job.id}`,
      href: `#/review/${job.id}`,
    }]);

    await b.updateSettings({ notifyWhenRead: false });
    assert((await b.startImport(pdf.files, pdf.bytes)).ok);
    await settledImports(b);
    assertEquals(notices.length, 1);
  } finally {
    close();
  }
});
