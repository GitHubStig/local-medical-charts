/**
 * Checks the Ollama setup for the settings page: which models are installed and
 * which can read images, and a three-step connection test. Reading report pages
 * goes through src/ollama.ts; this module only checks that it can work.
 */
import { encodeBase64 } from "@std/encoding/base64";
import type { OcrCheck, OcrModel, OcrModelList, OcrTest } from "../types.ts";
import { ocrMessages } from "./messages.ts";
import {
  TEST_IMAGE_ANSWER,
  TEST_IMAGE_QUESTION,
  testImagePng,
} from "./test-image.ts";

export type OllamaService = {
  listModels(host: string): Promise<OcrModelList>;
  test(host: string, model: string | null): Promise<OcrTest>;
};

/** Listing and looking up models should be instant. */
const QUICK_MS = 5_000;
/** The first request after launch loads the model into memory, which can take a while. */
const READ_MS = 180_000;

type ShowReply = {
  capabilities?: string[];
  details?: { parameter_size?: string };
  model_info?: Record<string, unknown>;
};

const isTimeout = (err: unknown) =>
  err instanceof DOMException &&
  (err.name === "TimeoutError" || err.name === "AbortError");

/** A failed request, in words for the settings page. */
function describe(host: string, err: unknown): string {
  if (isTimeout(err)) return ocrMessages.slow(host);
  // fetch rejects with a TypeError when nothing is listening.
  if (err instanceof TypeError) return ocrMessages.unreachable(host);
  return err instanceof Error ? err.message : String(err);
}

export function createOllamaService(
  deps: { fetch?: typeof fetch; testImage?: () => Uint8Array } = {},
): OllamaService {
  const fetchFn = deps.fetch ?? fetch;
  const testImage = deps.testImage ?? testImagePng;

  async function call<T>(
    host: string,
    path: string,
    timeoutMs: number,
    body?: unknown,
  ): Promise<T> {
    const response = await fetchFn(`${host}${path}`, {
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const text = (await response.text()).trim().slice(0, 200);
      throw new Error(`Ollama answered ${response.status}: ${text}`);
    }
    return await response.json() as T;
  }

  const show = (host: string, model: string) =>
    call<ShowReply>(host, "/api/show", QUICK_MS, { model });

  async function listModels(host: string): Promise<OcrModelList> {
    try {
      const { version } = await call<{ version: string }>(
        host,
        "/api/version",
        QUICK_MS,
      );
      const { models } = await call<{ models: { name: string }[] }>(
        host,
        "/api/tags",
        QUICK_MS,
      );
      const described = await Promise.all(
        models.map(async ({ name }) => ({
          name,
          info: await show(host, name),
        })),
      );
      const listed = described
        // Image generators can't chat at all; older Ollama versions don't report capabilities.
        .filter(({ info }) =>
          !info.capabilities || info.capabilities.includes("completion")
        )
        .map(({ name, info }): OcrModel => {
          const context = Object.entries(info.model_info ?? {})
            .find(([key]) => key.endsWith(".context_length"))?.[1];
          return {
            name,
            readsImages: info.capabilities?.includes("vision") ?? false,
            parameterSize: info.details?.parameter_size || null,
            contextLength: typeof context === "number" ? context : null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return { ok: true, host, version, models: listed };
    } catch (err) {
      return { ok: false, host, error: describe(host, err) };
    }
  }

  async function test(host: string, model: string | null): Promise<OcrTest> {
    const checks: OcrCheck[] = [];
    const result = (): OcrTest => ({
      host,
      model,
      ok: checks.length === 3 && checks.every((c) => c.ok),
      checks,
    });

    try {
      const { version } = await call<{ version: string }>(
        host,
        "/api/version",
        QUICK_MS,
      );
      checks.push({
        step: "reachable",
        ok: true,
        message: ocrMessages.running(version, host),
      });
    } catch (err) {
      checks.push({
        step: "reachable",
        ok: false,
        message: describe(host, err),
      });
      return result();
    }

    if (!model) {
      checks.push({
        step: "installed",
        ok: false,
        message: ocrMessages.noModel(),
      });
      return result();
    }
    let info: ShowReply;
    try {
      info = await show(host, model);
    } catch (err) {
      checks.push({
        step: "installed",
        ok: false,
        message: err instanceof Error && err.message.includes(" 404")
          ? ocrMessages.notInstalled(model)
          : describe(host, err),
      });
      return result();
    }
    checks.push({
      step: "installed",
      ok: true,
      message: ocrMessages.installed(model),
    });

    if (info.capabilities && !info.capabilities.includes("vision")) {
      checks.push({
        step: "reads-images",
        ok: false,
        message: ocrMessages.cantReadImages(model),
      });
      return result();
    }

    const started = Date.now();
    try {
      const reply = await call<{ message?: { content?: string } }>(
        host,
        "/api/chat",
        READ_MS,
        {
          model,
          stream: false,
          // Only models that think accept the switch; thinking adds nothing to reading a number.
          ...(info.capabilities?.includes("thinking") ? { think: false } : {}),
          options: { temperature: 0, num_predict: 16 },
          messages: [{
            role: "user",
            content: TEST_IMAGE_QUESTION,
            images: [encodeBase64(testImage())],
          }],
        },
      );
      const text = (reply.message?.content ?? "").trim();
      const read = text.includes(TEST_IMAGE_ANSWER);
      checks.push({
        step: "reads-images",
        ok: read,
        message: read
          ? ocrMessages.readOk((Date.now() - started) / 1000)
          : ocrMessages.misread(model, text),
      });
    } catch (err) {
      checks.push({
        step: "reads-images",
        ok: false,
        message: isTimeout(err)
          ? ocrMessages.readSlow(model)
          : ocrMessages.readFailed(model, describe(host, err)),
      });
    }
    return result();
  }

  return { listModels, test };
}
