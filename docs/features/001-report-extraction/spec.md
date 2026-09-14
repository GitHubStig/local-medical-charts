# 001. Report extraction pipeline: spec

## Problem

Lab reports exist as printed pages or PDFs. Before anything can be charted, each
report has to become structured data, and results from different labs have to be
recognised as the same test, without guessing.

## User stories

- As the owner, I can turn a report PDF into one image per page, including PDFs
  that are just scanned pages.
- As the owner, I can have a local vision model read those page images into
  JSON.
- As the owner, I get one merged report per report, not just per page.
- As the owner, results from different labs for the same test line up, and tests
  the app doesn't know are listed rather than guessed.

## Requirements

1. **PDF to images** (`deno task extract`): render each page at a chosen dpi, or
   extract the page's embedded image byte for byte for scanned PDFs.
2. **Reading** (`deno task ocr`): each page image goes to a local Ollama vision
   model with a prompt stored as Markdown. The model is configurable. Replies
   must validate against a schema; invalid replies are retried with the errors.
3. **Verbatim transcription:** values, units and ranges are copied as printed
   strings. Nothing is computed by the model.
4. **Per-page cache:** a page already read isn't read again unless forced.
5. **Merge:** a report's pages merge into one report with parsed results
   (number, comparator, words), flags (printed or derived from the range), and
   collection date.
6. **Catalog matching:** each result is matched to an analyte by exact name,
   specimen and unit; matched results get a standard-unit value. Unknown names
   are listed, with a reason.
7. **Growing the catalog** (`deno task map`): the model suggests matches for
   unknown names; nothing is added until a person accepts it.
8. Every page records the model and prompt hash that produced it; every report
   records the catalog hash.

## Acceptance criteria

- Two reports from different labs, with different names and units for the same
  tests, merge to reports whose shared tests have the same analyte id and
  comparable standard values.
- A result printed as `< 5` is a comparator, not the number 5.
- Re-running the merge on the same pages gives an identical report.
- An unknown test appears under "unmapped" and is never matched to a
  similar-sounding analyte.

## Out of scope

- A user interface (feature 004 onwards).
- Cloud models ([ADR 0001](../../adr/0001-local-only-processing.md)).
- Interpreting results medically.
