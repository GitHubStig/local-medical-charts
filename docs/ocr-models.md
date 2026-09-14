# Vision models tried for reading reports

Notes from comparing local Ollama models for reading lab report pages, kept for
when this comes up again. Nothing here is a decision; the app lets you pick any
installed model that reads images.

## How they were tested

- **Fictional pages:** three pages drawn from the sample reports in `samples/`
  (39 results), rendered as clean 150 dpi page images. Each result's value,
  unit, range and flag was scored against the sample it was drawn from.
- **Real reports:** three scanned PDFs (17 pages) read on the same machine, with
  nothing leaving it. Two of them (11 pages, 124 results) were scored against
  the earlier `qwen3.8:27b-mlx` readings in `3.data/`, which nobody had checked,
  so a difference can be either model's mistake. Only counts were recorded.
- **Two ways of asking:** the app's own prompt (`src/ocr-prompt.md`) with the
  JSON schema, as the app reads pages; and, for OCR-only models, their own short
  prompts, scored by finding each result in the text they returned.

Tested September 2026 on an Apple silicon Mac with Ollama.

## Large general vision models (the app's prompt and schema)

| Model                  | Memory | Fictional pages   | Time per page |
| ---------------------- | ------ | ----------------- | ------------- |
| `qwen3.8:27b-mlx`      | ~18 GB | 38/39, no retries | 55–60 s       |
| `gemma4:31b-mlx`       | ~19 GB | 38/39, no retries | 60–66 s       |
| `muse-glimmer:30b-mlx` | ~19 GB | 38/39, no retries | 50–54 s       |

All three missed the same result: a blood glucose read as the urine glucose
further down the page. Clean pages didn't separate them; photos, skewed scans or
heavy compression would be needed to. `qwen3.8:27b-mlx` also read the real scans
used as the reference below, in about a minute a page.

### `gemma4:31b-mlx` on the real scans

Through the app's page reader (17 pages): **103 s a page on average**, 32–121 s
for pages that went cleanly, at roughly 25 tokens a second. It's noticeably
slower than `qwen3.8:27b-mlx` on the same scans.

On 2 of the 17 pages it transcribed the rows and then **started writing them
over again, without end**. Before the fix below, one such page ran for the full
10 minute limit (26,000 tokens); Ollama's MLX engine doesn't stop a reply at the
context size. The client now streams replies, caps them at 8,192 tokens and
stops a reply as soon as it repeats itself, then retries with a note to write
each row once:

- one page recovered on its third attempt (281 s in all);
- one page failed all three (284 s), with the message "kept repeating itself on
  page N".

Each stopped attempt had written about 2,400 tokens, about as much as a real
page, so the time lost is the model's own writing speed.

## Small OCR-only models (for machines with 8 GB of memory)

Neither can fill in the app's JSON: with the app's prompt, both failed or
returned no results on every page. They can only transcribe, so on their own
they don't fit the app.

| Model                 | Size         | Memory | Prompt                                             | Fictional pages          | Real scans (124 results)                                                         | Time per page |
| --------------------- | ------------ | ------ | -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------- | ------------- |
| `glm-ocr:latest`      | 1.1B, 2.2 GB | 2.9 GB | `Table Recognition:`                               | all rows, no page header | 106 values on the right row, 5 missing; 23 ranges missing; no header             | 4–7 s         |
| `glm-ocr:latest`      |              |        | `Text Recognition:`                                | everything, with header  | most values present but separated from their test names; looped on 2 of 17 pages | 7–13 s        |
| `deepseek-ocr:latest` | 3.3B, 6.7 GB | 7.4 GB | `Free OCR.`                                        | everything, as Markdown  | 38 values missing; looped on 6 of 17 pages                                       | 5–16 s        |
| `deepseek-ocr:latest` |              |        | `<\|grounding\|>Convert the document to markdown.` | table cells run together | not tried                                                                        | 5–7 s         |

- `deepseek-ocr` is too large for 8 GB machines once loaded, and unreliable on
  real scans.
- `glm-ocr` is fast and small, but on real scans about 1 in 7 values and 1 in 5
  ranges differed from the large model's reading, compared with almost none on
  clean pages.

## Small general vision models (the app's prompt and schema)

| Model        | Size         | Memory | Fictional pages (39 results)                             | Real scans (124 results)                                                                                | Time per page |
| ------------ | ------------ | ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------- |
| `gemma4:e2b` | 5.1B, Q4_K_M | 7.1 GB | 26 rows found, 22 values right; no ID number on any page | 47 rows found, 22 values and 9 ranges agree; 40 rows the reference doesn't have; 13 of 44 header fields | 12–17 s       |

It always returned valid JSON, with no retries, but reads too little of the page
correctly to use: most rows are missing, and many it did return are merged or
renamed. Loaded, it's also too large for an 8 GB machine.

## Ideas not yet tried

1. **Two steps:** `glm-ocr` transcribes the page, then a small text-only model
   (3–4B) turns the text into the app's JSON. Loaded one after the other, memory
   stays around 3 GB.
2. **Another small general vision model** (e.g. a Qwen VL model) with the app's
   prompt and schema directly. `gemma4:e2b`, the first tried, read too little
   (above).
3. Harder pages (phone photos, skew, compression) to separate the large models.
