/**
 * Minimal Ollama client for structured replies.
 *
 * The Zod schema is sent as Ollama's `format`, which constrains decoding to
 * conforming JSON, and the reply is validated again on arrival. A reply that
 * still fails is retried with the validation errors fed back.
 */
import { z } from "@zod/zod";

export type OllamaConfig = {
  host: string;
  model: string;
  /** Context window, in tokens. */
  context: number;
  /** Extra attempts after a reply that fails validation. */
  retries: number;
};

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

/** Every attempt came back as invalid JSON or JSON that didn't match the schema. */
export class OllamaReplyError extends Error {
  override name = "OllamaReplyError";
  constructor(message: string, readonly attempts: number) {
    super(message);
  }
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

  let feedback = "";
  for (let attempt = 1; attempt <= config.retries + 1; attempt++) {
    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(`${config.host}/api/chat`, {
        method: "POST",
        signal: request.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          stream: false,
          // Thinking only pollutes transcription and matching output.
          think: false,
          format,
          options: { temperature: 0, num_ctx: config.context },
          messages: [{
            role: "user",
            content: feedback
              ? `${request.prompt}\n\n${feedback}`
              : request.prompt,
            images: request.images,
          }],
        }),
      });
    } catch (cause) {
      throw new Error(`request to ${config.host} failed: ${message(cause)}`, {
        cause,
      });
    }

    if (!response.ok) {
      throw new OllamaHttpError(
        response.status,
        `Ollama returned ${response.status}: ${(await response.text()).trim()}`,
      );
    }

    const body = await response.json() as { message?: { content?: string } };
    const seconds = (Date.now() - started) / 1000;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.message?.content ?? "");
    } catch {
      feedback = "Your previous reply was not valid JSON. Return JSON only.";
      console.warn(
        `    ${request.label}: attempt ${attempt} (${
          seconds.toFixed(1)
        }s) returned invalid JSON`,
      );
      continue;
    }

    const result = request.schema.safeParse(parsed);
    if (result.success) return { data: result.data, seconds };

    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
      .join("; ");
    feedback =
      `Your previous reply did not match the schema (${issues}). Fix those fields and return the whole JSON again.`;
    console.warn(
      `    ${request.label}: attempt ${attempt} (${
        seconds.toFixed(1)
      }s) failed validation: ${issues}`,
    );
  }

  throw new OllamaReplyError(
    `${request.label}: no valid response after ${
      config.retries + 1
    } attempt(s)`,
    config.retries + 1,
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
