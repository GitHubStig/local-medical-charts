# Swappable page reading

- **Status:** Parked by the owner until a second provider is actually chosen.

Read pages with a provider other than Ollama.

- **Already provider-neutral:** everything after a page is read takes a
  `PageExtraction`, and the import queue only uses the `PageReader` interface
  (`desktop/imports/reader.ts`), which `desktop/main.ts` passes into the
  bindings.
- **Ollama-specific today:** the `ollamaHost` and `ocrModel` settings, the
  Settings page's model list and connection test (`desktop/ocr/ollama.ts`,
  `listOcrModels` and `testOcr` in the contract), the reader's error wording,
  and the command-line pipeline (`src/ocr-reports.ts`, `src/map-analytes.ts`
  through `src/ollama.ts`).
- **When it's picked up:** add an adapter implementing `PageReader`, a provider
  choice in Settings with each provider's own fields and connection test, and
  provider-neutral names for those settings and contract calls. A cloud provider
  needs [ADR 0001](../adr/0001-local-only-processing.md) revisited first.
- **Owner's direction:** target the OpenAI-compatible API rather than Ollama's
  own. Ollama serves it too (`/v1/chat/completions`), so Ollama keeps working,
  and so do LM Studio and other local servers.
  [ADR 0011](../adr/0011-own-ollama-client.md) would need superseding.
- **What doesn't carry over from Ollama's API:** the model list's "reads images"
  check (`/api/show`), the fallback to `thinking` when a model's template puts
  the reply there, `done_reason` for a reply cut off at the token cap, and
  `format` taking a JSON Schema (the OpenAI form is `response_format`, and how
  well each server enforces it varies). The repeat and silence guards work on
  any stream.
- **Remote addresses:** any http(s) address is accepted today with no warning,
  so page images can leave the machine, unencrypted over plain http. ADR 0001
  says reading happens on the same machine. Add a warning for an address that
  isn't loopback with the new provider settings, rather than to the Ollama
  address now.
