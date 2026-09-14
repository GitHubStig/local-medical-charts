import { assert, assertEquals, assertMatch } from "@std/assert";
import { createOllamaService } from "./ollama.ts";
import { TEST_IMAGE_ANSWER, testImagePng } from "./test-image.ts";

// A stand-in Ollama on 127.0.0.1: the tests never talk to a real one.

type FakeModel = {
  name: string;
  capabilities: string[];
  size?: string;
  context?: number;
};

const MODELS: FakeModel[] = [
  {
    name: "vision-model:27b",
    capabilities: ["completion", "vision", "thinking"],
    size: "27.8B",
    context: 262144,
  },
  {
    name: "text-model:8b",
    capabilities: ["completion", "tools"],
    size: "8B",
    context: 32768,
  },
  { name: "x/image-generator:9b", capabilities: ["image"] },
];

/** What the tests look at in a request to the stand-in. */
type RequestBody = {
  model?: string;
  think?: boolean;
  messages?: { images?: string[] }[];
};
type Recorded = { path: string; body: RequestBody | null };

async function withFakeOllama(
  options: { reply?: string; models?: FakeModel[] },
  run: (host: string, requests: Recorded[]) => Promise<void>,
) {
  const models = options.models ?? MODELS;
  const requests: Recorded[] = [];
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (request) => {
      const path = new URL(request.url).pathname;
      const body: RequestBody | null = request.method === "POST"
        ? await request.json()
        : null;
      requests.push({ path, body });
      if (path === "/api/version") return Response.json({ version: "0.34.0" });
      if (path === "/api/tags") {
        return Response.json({ models: models.map((m) => ({ name: m.name })) });
      }
      if (path === "/api/show") {
        const model = models.find((m) => m.name === body?.model);
        return model
          ? Response.json({
            capabilities: model.capabilities,
            details: { parameter_size: model.size ?? "" },
            model_info: model.context
              ? { "arch.context_length": model.context }
              : {},
          })
          : Response.json({ error: `model '${body?.model}' not found` }, {
            status: 404,
          });
      }
      if (path === "/api/chat") {
        return Response.json({
          message: { content: options.reply ?? TEST_IMAGE_ANSWER },
        });
      }
      return new Response("not found", { status: 404 });
    },
  );
  try {
    await run(`http://127.0.0.1:${server.addr.port}`, requests);
  } finally {
    await server.shutdown();
  }
}

/** An address nothing listens on: a server that has already stopped. */
async function closedHost(): Promise<string> {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    () => new Response(),
  );
  const host = `http://127.0.0.1:${server.addr.port}`;
  await server.shutdown();
  return host;
}

const tinyImage = () => new Uint8Array([137, 80, 78, 71]);

Deno.test("models are listed with whether they read images; image generators are left out", async () => {
  await withFakeOllama({}, async (host) => {
    const list = await createOllamaService({ testImage: tinyImage }).listModels(
      host,
    );
    assertEquals(list, {
      ok: true,
      host,
      version: "0.34.0",
      models: [
        {
          name: "text-model:8b",
          readsImages: false,
          parameterSize: "8B",
          contextLength: 32768,
        },
        {
          name: "vision-model:27b",
          readsImages: true,
          parameterSize: "27.8B",
          contextLength: 262144,
        },
      ],
    });
  });
});

Deno.test("an address with nothing listening explains itself", async () => {
  const host = await closedHost();
  const service = createOllamaService({ testImage: tinyImage });
  const list = await service.listModels(host);
  assertEquals(list.ok, false);
  assert(
    !list.ok &&
      list.error ===
        `Couldn't reach Ollama at ${host.slice(7)}. Is it running?`,
  );

  const test = await service.test(host, "vision-model:27b");
  assertEquals(test.ok, false);
  assertEquals(test.checks.map((c) => [c.step, c.ok]), [["reachable", false]]);
});

Deno.test("a working setup passes all three checks, sending the test image", async () => {
  await withFakeOllama({}, async (host, requests) => {
    const test = await createOllamaService({ testImage: tinyImage }).test(
      host,
      "vision-model:27b",
    );
    assertEquals(test.ok, true);
    assertEquals(test.checks.map((c) => [c.step, c.ok]), [
      ["reachable", true],
      ["installed", true],
      ["reads-images", true],
    ]);
    assertEquals(
      test.checks[0].message,
      `Ollama 0.34.0 is running at ${host.slice(7)}`,
    );
    assertMatch(
      test.checks[2].message,
      /^Read a test image correctly in \d+\.\d s$/,
    );

    const chat = requests.find((r) => r.path === "/api/chat")!.body!;
    assertEquals(chat.model, "vision-model:27b");
    assertEquals(chat.messages?.[0].images, ["iVBORw=="]);
    assertEquals(chat.think, false, "a thinking model is told not to think");
  });
});

Deno.test("each failed step says what to do, and later steps don't run", async () => {
  await withFakeOllama({ reply: "4.2" }, async (host, requests) => {
    const service = createOllamaService({ testImage: tinyImage });
    const steps = async (model: string | null) =>
      (await service.test(host, model)).checks.map((
        c,
      ) => [c.step, c.ok, c.message]);

    assertEquals((await steps(null)).at(-1), [
      "installed",
      false,
      "Choose a model first.",
    ]);
    assertEquals((await steps("missing:7b")).at(-1), [
      "installed",
      false,
      "missing:7b isn't installed. Install it with: ollama pull missing:7b",
    ]);

    requests.length = 0;
    assertEquals((await steps("text-model:8b")).at(-1), [
      "reads-images",
      false,
      "text-model:8b can't read images. Choose a model marked “Reads images”.",
    ]);
    assert(
      !requests.some((r) => r.path === "/api/chat"),
      "a text-only model isn't sent the image",
    );

    assertEquals((await steps("vision-model:27b")).at(-1), [
      "reads-images",
      false,
      "vision-model:27b read the test image as “4.2”, not the value on it.",
    ]);
  });
});

Deno.test("the test image is a real PNG, drawn with mupdf", () => {
  const png = testImagePng();
  assertEquals([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert(png.length > 1000);
});
