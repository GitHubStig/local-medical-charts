# 001. Report extraction pipeline: tasks

- [x] `deno task extract`: render PDF pages to PNG or JPEG at a chosen dpi
- [x] `--embedded`: write each page's embedded scan unchanged (JPEG, JPEG 2000)
      or re-encoded when it isn't a standalone image format
- [x] Page schema in Zod: provider, patient, doctor, dates by meaning, header
      fields, test rows with measurements, continuation text, interpretation,
      specimen notes, warnings
- [x] Transcription prompt as Markdown, with fictional examples of each row
      layout
- [x] Ollama client: schema as `format`, thinking off, temperature 0, validation
      retries with feedback
- [x] `deno task ocr`: group page images by report, read pages, cache
      `*.page.json`, `--force`, `--merge-only`, `--pages-only`, `--dry-run`
- [x] Merge: parse results (number, comparator, words) and ranges (between,
      below, above, qualitative, text)
- [x] Flags: printed markers first, derived from the range otherwise
- [x] Collection date chosen by label meaning; reported date kept separately
- [x] Analyte catalog with aliases, specimen, standard unit and unit factors;
      exact lookup
- [x] Standard-unit values for matched results; unknown names listed under
      `unmapped` with a reason
- [x] `deno task map`: list unknown names, ask for suggestions, apply only
      accepted ones
- [x] Record model, prompt hash and catalog hash in outputs
- [x] Tests for parsing, merging, catalog lookup and suggestions, on synthetic
      data
