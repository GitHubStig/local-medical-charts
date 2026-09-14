/**
 * Reads one page image with an Ollama vision model, under the transcription
 * prompt, into a page extraction. Failures become ImportErrors worded for the
 * imports list; a cancel is passed through untouched.
 */
import { encodeBase64 } from "@std/encoding/base64";
import { pagePrompt, promptHash } from "../../src/ocr-prompt.ts";
import {
  chatJson,
  OllamaHttpError,
  OllamaReplyError,
  REPLY_IDLE_SECONDS,
} from "../../src/ollama.ts";
import { type PageExtraction, PageExtractionSchema } from "../../src/schema.ts";
import { ocrMessages } from "../ocr/messages.ts";
import { ImportError, importMessages } from "./messages.ts";
import type { PageImage } from "./sources.ts";

export type PageReader = {
  model: string;
  /** Recorded with each page, so a changed prompt means reading pages again. */
  promptHash: string;
  read(
    image: PageImage,
    page: number,
    pageCount: number,
    signal: AbortSignal,
  ): Promise<PageExtraction>;
};

/** A page takes about a minute on a fast machine; loading a large model first adds more. */
export const PAGE_MINUTES = 10;

/** The same as `deno task ocr`, so both read pages alike. */
const CONTEXT = 16_384;
const RETRIES = 2;

export async function ollamaPageReader(
  host: string,
  model: string,
  options: { pageMinutes?: number; idleSeconds?: number } = {},
): Promise<PageReader> {
  const hash = await promptHash();
  const minutes = options.pageMinutes ?? PAGE_MINUTES;
  const idleSeconds = options.idleSeconds ?? REPLY_IDLE_SECONDS;

  return {
    model,
    promptHash: hash,
    async read(image, page, pageCount, signal) {
      const limit = AbortSignal.timeout(minutes * 60_000);
      try {
        const { data } = await chatJson(
          { host, model, context: CONTEXT, retries: RETRIES, idleSeconds },
          {
            label: `page ${page} of ${pageCount}`,
            prompt: pagePrompt(page, pageCount),
            images: [encodeBase64(image.bytes)],
            schema: PageExtractionSchema,
            signal: AbortSignal.any([signal, limit]),
          },
        );
        return data;
      } catch (err) {
        // Cancelled: whoever cancelled already knows.
        if (signal.aborted) throw err;
        const because = { cause: err };
        if (limit.aborted) {
          throw new ImportError(
            importMessages.pageSlow(model, page, minutes),
            because,
          );
        }
        if (err instanceof OllamaReplyError) {
          throw new ImportError(
            err.reason === "repeating"
              ? importMessages.repeating(model, page)
              : err.reason === "stalled"
              ? importMessages.stalled(model, page, idleSeconds / 60)
              : importMessages.unreadable(model, page, err.attempts),
            because,
          );
        }
        if (err instanceof OllamaHttpError) {
          throw new ImportError(
            err.status === 404
              ? ocrMessages.notInstalled(model)
              : importMessages.ollamaError(err.message),
            because,
          );
        }
        // fetch rejects with a TypeError when nothing is listening.
        if (err instanceof Error && err.cause instanceof TypeError) {
          throw new ImportError(ocrMessages.unreachable(host), because);
        }
        throw err;
      }
    },
  };
}
