/**
 * The page transcription prompt, shared by the OCR command and the desktop app.
 *
 * Imported as text so it is part of the module graph: the desktop app bundles
 * it rather than looking for the file at runtime.
 */
import { encodeHex } from "@std/encoding/hex";
import OCR_PROMPT from "./ocr-prompt.md" with { type: "text" };

export { OCR_PROMPT };

/** First 12 hex digits of the prompt's SHA-256, recorded with every page read. */
export async function promptHash(text: string = OCR_PROMPT): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return encodeHex(new Uint8Array(digest)).slice(0, 12);
}

/** The prompt for one page, with its page number filled in. */
export function pagePrompt(
  page: number,
  pageCount: number,
  text: string = OCR_PROMPT,
): string {
  return text
    .replaceAll("{{PAGE}}", String(page))
    .replaceAll("{{PAGE_COUNT}}", String(pageCount));
}
