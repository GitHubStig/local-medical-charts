import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { pagePrompt } from "../../src/ocr-prompt.ts";
import { syntheticExtraction } from "../store/testing.ts";
import { ImportError } from "./messages.ts";
import { ollamaPageReader } from "./reader.ts";
import type { PageImage } from "./sources.ts";

// A stand-in Ollama on 127.0.0.1 with made-up replies: never a real one.

type ChatBody = {
  model: string;
  format?: unknown;
  messages: { content: string; images?: string[] }[];
};

async function withStandIn(
  respond: () => Response | Promise<Response>,
  run: (host: string, bodies: ChatBody[]) => Promise<void>,
) {
  const bodies: ChatBody[] = [];
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (request) => {
      bodies.push(await request.json());
      return respond();
    },
  );
  try {
    await run(`http://127.0.0.1:${server.addr.port}`, bodies);
  } finally {
    await server.shutdown();
  }
}

/** Answers well after the reader has given up waiting. */
const hang = () =>
  new Promise<Response>((resolve) =>
    setTimeout(() => resolve(new Response("too late")), 200)
  );

const reply = (content: string) => Response.json({ message: { content } });

const image: PageImage = {
  name: "example-1.png",
  type: "image/png",
  bytes: new Uint8Array([137, 80, 78, 71]),
  origin: "rendered",
};
const notCancelled = () => new AbortController().signal;

/** chatJson logs each failed attempt; keep test output clean. */
async function quietly(fn: () => Promise<void>) {
  const warn = console.warn;
  console.warn = () => {};
  try {
    await fn();
  } finally {
    console.warn = warn;
  }
}

Deno.test("a page goes to Ollama with its page number, image and schema", async () => {
  await withStandIn(
    () => reply(JSON.stringify(syntheticExtraction({ page: 2, pageCount: 3 }))),
    async (host, bodies) => {
      const reader = await ollamaPageReader(host, "vision:27b");
      assertEquals(reader.model, "vision:27b");
      assertEquals(reader.promptHash.length, 12);

      const extraction = await reader.read(image, 2, 3, notCancelled());
      assertEquals(extraction.tests.length, 3);

      const [body] = bodies;
      assertEquals(body.model, "vision:27b");
      assertEquals(body.messages[0].content, pagePrompt(2, 3));
      assertStringIncludes(body.messages[0].content, "page 2 of 3");
      assertEquals(body.messages[0].images, ["iVBORw=="]);
      assert(body.format, "the schema constrains the reply");
    },
  );
});

Deno.test("a reply that never fits the schema gives up after three tries", async () => {
  await withStandIn(() => reply("{}"), async (host, bodies) => {
    const reader = await ollamaPageReader(host, "vision:27b");
    await quietly(async () => {
      const err = await assertRejects(
        () => reader.read(image, 1, 2, notCancelled()),
        ImportError,
      );
      assertEquals(
        err.message,
        "vision:27b couldn't give a usable reading of page 1 after 3 tries.",
      );
    });
    assertEquals(bodies.length, 3);
  });
});

Deno.test("a model that isn't installed says how to install it", async () => {
  await withStandIn(
    () => Response.json({ error: "model not found" }, { status: 404 }),
    async (host) => {
      const reader = await ollamaPageReader(host, "missing:7b");
      await assertRejects(
        () => reader.read(image, 1, 1, notCancelled()),
        ImportError,
        "missing:7b isn't installed. Install it with: ollama pull missing:7b",
      );
    },
  );
});

Deno.test("an address with nothing listening explains itself", async () => {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    () => new Response(),
  );
  const host = `http://127.0.0.1:${server.addr.port}`;
  await server.shutdown();

  const reader = await ollamaPageReader(host, "vision:27b");
  await assertRejects(
    () => reader.read(image, 1, 1, notCancelled()),
    ImportError,
    `Couldn't reach Ollama at ${host.slice(7)}. Is it running?`,
  );
});

Deno.test("a page that takes too long times out; a cancel is passed through", async () => {
  await withStandIn(hang, async (host) => {
    const slow = await ollamaPageReader(host, "vision:27b", {
      pageMinutes: 0.001,
    });
    await assertRejects(
      () => slow.read(image, 4, 5, notCancelled()),
      ImportError,
      "vision:27b didn't finish reading page 4",
    );

    const reader = await ollamaPageReader(host, "vision:27b");
    const cancel = new AbortController();
    setTimeout(() => cancel.abort(), 20);
    const err = await assertRejects(() =>
      reader.read(image, 1, 1, cancel.signal)
    );
    assert(!(err instanceof ImportError), "a cancel isn't a reading failure");
  });
});
