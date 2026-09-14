/**
 * Minimal Ollama client for structured replies.
 *
 * The Zod schema is sent as Ollama's `format`, which constrains decoding to
 * conforming JSON, and the reply is validated again on arrival. A reply that
 * still fails is retried with the validation errors fed back.
 *
 * Replies are streamed and capped, because a model can get stuck writing the
 * same rows over and over: gemma4:31b once wrote 26,000 tokens for one page, and
 * Ollama's MLX engine doesn't stop it at the context size. A reply that starts
 * repeating itself is stopped within a few hundred tokens and retried.
 */
import { z } from "@zod/zod";

export type OllamaConfig = {
  host: string;
  model: string;
  /** Context window, in tokens. */
  context: number;
  /** Extra attempts after a reply that fails validation. */
  retries: number;
  /** Longest reply allowed, in tokens; MAX_REPLY_TOKENS when not given. */
  maxTokens?: number;
};

/** A page's JSON is a few thousand tokens; many more means the model is repeating itself. */
export const MAX_REPLY_TOKENS = 8192;

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Ollama answered with an error status, e.g. 404 for a model that isn't installed. */
export class OllamaHttpError extends Error {
  override name = "OllamaHttpError";
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Every attempt came back as invalid JSON, JSON that didn't match the schema, or a reply stuck repeating itself. */
export class OllamaReplyError extends Error {
  override name = "OllamaReplyError";
  constructor(
    message: string,
    readonly attempts: number,
    /** What went wrong with the last attempt. */
    readonly reason: "invalid" | "repeating" = "invalid",
  ) {
    super(message);
  }
}

/**
 * True when the end of a reply already appeared several times just before it:
 * a model writing the same stretch over and over. Real rows differ in names
 * and values, so a 400-character stretch doesn't recur in a genuine reply.
 */
export function isRepeating(text: string, stretch = 400, times = 4): boolean {
  if (text.length < stretch * times) return false;
  const recent = text.slice(-stretch * times * 3);
  const tail = text.slice(-stretch);
  let found = 0;
  for (
    let at = recent.indexOf(tail);
    at >= 0;
    at = recent.indexOf(tail, at + 1)
  ) {
    if (++found >= times) return true;
  }
  return false;
}

type Reply = {
  content: string;
  seconds: number;
  /** done: the model finished; length: it hit the token cap; repeating: it was stopped for repeating itself. */
  stopped: "done" | "length" | "repeating";
};

/** One streamed /api/chat request, watched for a reply that repeats itself. */
async function streamReply(
  host: string,
  body: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<Reply> {
  const started = Date.now();
  const seconds = () => (Date.now() - started) / 1000;
  const stop = new AbortController();
  let response: Response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: "POST",
      signal: signal ? AbortSignal.any([signal, stop.signal]) : stop.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new Error(`request to ${host} failed: ${message(cause)}`, { cause });
  }
  if (!response.ok) {
    throw new OllamaHttpError(
      response.status,
      `Ollama returned ${response.status}: ${(await response.text()).trim()}`,
    );
  }

  let content = "";
  let doneReason: string | undefined;
  // Ollama streams one JSON object per line.
  const take = (line: string) => {
    if (!line.trim()) return;
    const part = JSON.parse(line) as {
      message?: { content?: string };
      done_reason?: string;
      error?: string;
    };
    if (part.error) throw new Error(`Ollama: ${part.error}`);
    content += part.message?.content ?? "";
    doneReason = part.done_reason ?? doneReason;
  };

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let chunks = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
        take(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
      if (++chunks % 25 === 0 && isRepeating(content)) {
        stop.abort();
        return { content, seconds: seconds(), stopped: "repeating" };
      }
    }
    take(buffer + decoder.decode());
  } catch (err) {
    if (stop.signal.aborted && !signal?.aborted) {
      return { content, seconds: seconds(), stopped: "repeating" };
    }
    throw err;
  }
  return {
    content,
    seconds: seconds(),
    stopped: doneReason === "length" ? "length" : "done",
  };
}

export async function assertModelAvailable(
  config: OllamaConfig,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${config.host}/api/tags`);
  } catch (cause) {
    throw new Error(
      `cannot reach Ollama at ${config.host} — is it running? (${
        message(cause)
      })`,
    );
  }
  if (!response.ok) {
    throw new Error(`Ollama at ${config.host} returned ${response.status}`);
  }
  const { models } = await response.json() as { models: { name: string }[] };
  const names = models.map((m) => m.name);
  if (!names.includes(config.model)) {
    throw new Error(
      `model ${config.model} not found on ${config.host}. Available: ${
        names.join(", ")
      }`,
    );
  }
}

export async function chatJson<T>(
  config: OllamaConfig,
  request: {
    /** Names the request in log lines and errors. */
    label: string;
    prompt: string;
    /** Base64-encoded images. */
    images?: string[];
    schema: z.ZodType<T>;
    /** Stops waiting for Ollama: a cancel, or a time limit. */
    signal?: AbortSignal;
  },
): Promise<{ data: T; seconds: number }> {
  const format = toOllamaFormat(request.schema);
  const maxTokens = config.maxTokens ?? MAX_REPLY_TOKENS;

  let feedback = "";
  let reason: "invalid" | "repeating" = "invalid";
  for (let attempt = 1; attempt <= config.retries + 1; attempt++) {
    const reply = await streamReply(config.host, {
      model: config.model,
      stream: true,
      // Thinking only pollutes transcription and matching output.
      think: false,
      format,
      options: {
        temperature: 0,
        num_ctx: config.context,
        num_predict: maxTokens,
      },
      messages: [{
        role: "user",
        content: feedback ? `${request.prompt}\n\n${feedback}` : request.prompt,
        images: request.images,
      }],
    }, request.signal);
    const took = `attempt ${attempt} (${reply.seconds.toFixed(1)}s)`;

    if (reply.stopped !== "done") {
      reason = "repeating";
      feedback =
        "Your previous reply repeated itself until it was stopped. Transcribe each printed row exactly once, then close the JSON.";
      console.warn(
        `    ${request.label}: ${took} ${
          reply.stopped === "length"
            ? `ran past ${maxTokens} tokens`
            : "kept repeating itself"
        } and was stopped`,
      );
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(reply.content);
    } catch {
      reason = "invalid";
      feedback = "Your previous reply was not valid JSON. Return JSON only.";
      console.warn(`    ${request.label}: ${took} returned invalid JSON`);
      continue;
    }

    const result = request.schema.safeParse(parsed);
    if (result.success) return { data: result.data, seconds: reply.seconds };

    reason = "invalid";
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
      .join("; ");
    feedback =
      `Your previous reply did not match the schema (${issues}). Fix those fields and return the whole JSON again.`;
    console.warn(`    ${request.label}: ${took} failed validation: ${issues}`);
  }

  throw new OllamaReplyError(
    `${request.label}: no valid response after ${
      config.retries + 1
    } attempt(s)`,
    config.retries + 1,
    reason,
  );
}

/**
 * JSON Schema for Ollama's `format`. Its grammar conversion is happier with
 * `type: [..., "null"]` than `anyOf`, and array-length and integer bounds are
 * left to Zod's validation instead.
 */
export function toOllamaFormat(schema: z.ZodType): Record<string, unknown> {
  return simplify(z.toJSONSchema(schema, { target: "draft-7" })) as Record<
    string,
    unknown
  >;
}

function simplify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplify);
  if (node === null || typeof node !== "object") return node;

  const obj = { ...node as Record<string, unknown> };

  const anyOf = obj.anyOf;
  if (Array.isArray(anyOf) && anyOf.length === 2) {
    const variants = anyOf as Record<string, unknown>[];
    const nullBranch = variants.find((v) => v.type === "null");
    const other = variants.find((v) => v.type !== "null");
    if (nullBranch && other && typeof other.type === "string") {
      delete obj.anyOf;
      Object.assign(obj, other, { type: [other.type, "null"] });
      if (Array.isArray(other.enum)) obj.enum = [...other.enum, null];
    }
  }

  delete obj.minItems;
  delete obj.maxItems;
  if (obj.type === "integer" || obj.type === "number") {
    delete obj.minimum;
    delete obj.maximum;
  }

  for (const [key, value] of Object.entries(obj)) obj[key] = simplify(value);
  return obj;
}
