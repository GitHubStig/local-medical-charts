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
