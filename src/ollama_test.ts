import { assert, assertEquals, assertRejects } from "@std/assert";
import { z } from "@zod/zod";
import {
  chatJson,
  isRepeating,
  MAX_REPLY_TOKENS,
  OllamaReplyError,
} from "./ollama.ts";

// A stand-in Ollama on 127.0.0.1 streaming made-up replies: never a real one.

const Schema = z.object({
  tests: z.array(z.object({ name: z.string(), value: z.string() })),
});
const row = (i: number) =>
  `{"name":"Test number ${i}","value":"${(i * 1.7).toFixed(1)}"},`;

/** Streams each piece as its own line, then a final line with `doneReason`; or pieces forever. */
async function withStreamingOllama(
  reply: { pieces: string[]; doneReason?: string } | { forever: string },
  run: (host: string, bodies: Record<string, unknown>[]) => Promise<void>,
) {
  const bodies: Record<string, unknown>[] = [];
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (request) => {
      bodies.push(await request.json());
      const encoder = new TextEncoder();
      const line = (content: string, extra = {}) =>
        encoder.encode(
          JSON.stringify({ message: { content }, done: false, ...extra }) +
            "\n",
        );
      let timer: ReturnType<typeof setInterval> | undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          if ("forever" in reply) {
            timer = setInterval(() => {
              try {
                controller.enqueue(line(reply.forever));
              } catch {
                clearInterval(timer);
              }
            }, 1);
            return;
          }
          for (const piece of reply.pieces) controller.enqueue(line(piece));
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                done: true,
                done_reason: reply.doneReason ?? "stop",
              }) + "\n",
            ),
          );
          controller.close();
        },
        cancel() {
          clearInterval(timer);
        },
      });
      return new Response(stream, {
        headers: { "content-type": "application/x-ndjson" },
      });
    },
  );
  try {
    await run(`http://127.0.0.1:${server.addr.port}`, bodies);
  } finally {
    await server.shutdown();
  }
}

async function quietly(fn: () => Promise<void>) {
  const warn = console.warn;
  console.warn = () => {};
  try {
    await fn();
  } finally {
    console.warn = warn;
  }
}

const config = (host: string) => ({
  host,
  model: "stand-in:1b",
  context: 16384,
  retries: 1,
});

Deno.test("a stretch written over and over is spotted; varied rows aren't", () => {
  const varied = `{"tests":[${
    Array.from({ length: 80 }, (_, i) => row(i)).join("")
  }`;
  assertEquals(isRepeating(varied), false);
  const stuck = `{"tests":[${row(1)}${
    Array.from({ length: 60 }, () => row(2) + row(3) + row(4)).join("")
  }`;
  assertEquals(isRepeating(stuck), true);
  assertEquals(isRepeating(row(2).repeat(3)), false, "too short to tell");
});

Deno.test("a streamed reply is put back together and validated, with a token cap", async () => {
  const json = JSON.stringify({ tests: [{ name: "Glucose", value: "5.2" }] });
  await withStreamingOllama({
    pieces: [json.slice(0, 10), json.slice(10, 25), json.slice(25)],
  }, async (host, bodies) => {
    const { data } = await chatJson(config(host), {
      label: "page 1",
      prompt: "read",
      schema: Schema,
    });
    assertEquals(data, { tests: [{ name: "Glucose", value: "5.2" }] });
    assertEquals(bodies[0].stream, true);
    assertEquals(
      (bodies[0].options as Record<string, number>).num_predict,
      MAX_REPLY_TOKENS,
    );
  });
});

Deno.test("a reply stuck repeating itself is stopped early, retried, then reported as repeating", async () => {
  await withStreamingOllama(
    { forever: row(7) + row(8) },
    async (host, bodies) => {
      const started = Date.now();
      await quietly(async () => {
        const err = await assertRejects(
          () =>
            chatJson(config(host), {
              label: "page 3",
              prompt: "read",
              schema: Schema,
            }),
          OllamaReplyError,
        );
        assertEquals([err.reason, err.attempts], ["repeating", 2]);
      });
      assert(
        Date.now() - started < 10_000,
        "stopped within seconds, not minutes",
      );
      assertEquals(bodies.length, 2);
      assert(
        String((bodies[1].messages as { content: string }[])[0].content)
          .includes("repeated itself"),
      );
    },
  );
});

Deno.test("a reply cut off at the token cap counts as repeating", async () => {
  await withStreamingOllama({
    pieces: ['{"tests":[', row(1)],
    doneReason: "length",
  }, async (host) => {
    await quietly(async () => {
      const err = await assertRejects(
        () =>
          chatJson(config(host), {
            label: "page 1",
            prompt: "read",
            schema: Schema,
          }),
        OllamaReplyError,
      );
      assertEquals(err.reason, "repeating");
    });
  });
});
