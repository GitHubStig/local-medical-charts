# 001. Report extraction pipeline: plan

## Approach

Two layers of data
([ADR 0002](../../adr/0002-model-transcribes-code-interprets.md)): the model
transcribes each page into `PageExtraction`, deliberately close to what is
printed; deterministic code merges pages into a `Report`. A catalog decides
which printed names are the same analyte.

## Modules

| File                                       | Role                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `src/pdf-to-images.ts`                     | CLI with `@std/cli`; mupdf (WebAssembly) renders pages or pulls embedded images                  |
| `src/schema.ts`                            | Zod schemas: `PageExtraction`, `PageFile`, `Report`, results, ranges                             |
| `src/ocr-prompt.md`                        | Transcription rules: copy never compute, header slots by meaning, row layouts, what isn't a test |
| `src/ollama.ts`                            | Chat with the schema as Ollama `format`; validate; retry with the validation errors              |
| `src/ocr-reports.ts`                       | CLI: find page images by name, read, cache page JSON, merge per report                           |
| `src/normalize.ts`                         | Parse results and ranges, derive flags, pick the collection date, match, convert units           |
| `src/catalog.ts`, `src/analytes.json`      | Analytes with aliases, specimen, standard unit, unit factors; exact lookup                       |
| `src/map-analytes.ts`, `src/map-prompt.md` | CLI: list unknown names, ask for suggestions, apply accepted ones                                |

## Data decisions

- **Flat rows:** one test row with a list of measurements (percentage and
  absolute count, or two units) rather than nested structures.
- **Ranges as text first:** the printed range is always kept; code parses plain
  numeric, single-bound and qualitative ranges, and leaves banded ranges as
  text.
- **Merged output is the product, page files are for debugging and caching:**
  both are written.

## Testing

- `normalize_test.ts`: parsing, flags, dates, merge determinism, no personal
  values in warnings.
- `catalog_test.ts`, `map-analytes_test.ts`: lookup rules and suggestion
  handling.
- Fixtures are synthetic ([ADR 0013](../../adr/0013-fictional-data-only.md)).
