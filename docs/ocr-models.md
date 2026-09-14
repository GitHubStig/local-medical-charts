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
| `qwen3.8:27b-mlx`      | ~18 GB | 39/39, no retries | 55–60 s       |
| `gemma4:31b-mlx`       | ~19 GB | 39/39, no retries | 60–66 s       |
| `muse-glimmer:30b-mlx` | ~19 GB | 39/39, no retries | 50–54 s       |

All three read every result correctly. (An earlier count said 38/39 for each,
but that was the scorer: the page has a blood and a urine test both named
Glucose, and it mixed them up.) Clean pages didn't separate the three; photos,
skewed scans or heavy compression would be needed to. `qwen3.8:27b-mlx` also
read the real scans used as the reference below, in about a minute a page.

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
page, so the time lost is the model's own writing speed. With the current
prompt, no page repeated (see [Prompt changes](#prompt-changes)).

## Small OCR-only models (for machines with 8 GB of memory)

Neither can fill in the app's JSON: with the app's prompt, old or new, both
failed or returned no results on every page. They can only transcribe, so on
their own they don't fit the app.

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

| Model         | Size                 | Memory       | Fictional pages (39 results)                                                                               | Real scans (124 results)                                                                                                          | Time per page             |
| ------------- | -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `gemma4:e2b`  | 5.1B, Q4_K_M         | 7.1 GB       | 26 rows found, 23 values right; no ID number on any page                                                   | 47 rows found, 19 values and 9 ranges agree; 43 rows the reference doesn't have; 13 of 44 header fields                           | 12–17 s                   |
| `qwen3-vl:4b` | 4.4B, Q4_K_M, 3.3 GB | 5.5 GB       | 39/39, every value, unit, range and flag right; collection date missed on 1 of 3 pages                     | 119 rows found; 111 values, 115 units, 102 ranges and 115 flags agree; 24 rows the reference doesn't have; 43 of 44 header fields | 30 s fictional, 49 s real |
| `qwen3-vl:8b` | 8.8B, Q4_K_M, 6.1 GB | not measured | no page read: 3 invalid replies on the first page (93 s), the 10 minute limit on the second; stopped there | not tried                                                                                                                         | —                         |

**`gemma4:e2b`** always returned valid JSON, with no retries, but reads too
little of the page correctly to use: most rows are missing, and many it did
return are merged or renamed. Loaded, it's also too large for an 8 GB machine.

**`qwen3-vl:4b`** is the first small model close to the large ones (figures
above are with the current prompt; see [Prompt changes](#prompt-changes)). On
the real scans it read all 17 pages with no failures and one retry, and missed 5
rows across three pages. Of the differences from the reference, ranges were the
most common (17), then values (8), markers (4) and units (4); the reference is
itself unchecked, so some of these may be the reference's mistakes. On real
scans it isn't much faster than the large models (49 s against about a minute a
page).

- **Fit:** 5.5 GB loaded with the app's 16k context. That should fit a 12 GB
  graphics card, but is likely too tight for an 8 GB Mac, where macOS lets the
  GPU use only part of the memory. Neither has been tried.
- **Quirk:** with thinking off and a JSON `format`, Qwen3-VL returns its whole
  reply in `thinking` and leaves `content` empty. Before the client fell back to
  `thinking`, every page failed; the results above are with the fallback.

**`qwen3-vl:8b`** failed even with the fallback, so its real-scan run was
skipped.

## Prompt changes

Six changes to `src/ocr-prompt.md`, aimed at the problems above: write each row
once and close the JSON (runaway repetition); a check before finishing that
every row is in `tests` (a page with 2 of 14 rows); one rule for what counts as
a test row (extra rows); an example of a range printed over several lines
(ranges were the most common difference); a short recap at the end; and empty
lists as `[]`. Each model was run with the old and new prompt, one run at a
time.

| Real scans (124 results)             | `qwen3-vl:4b` old | `qwen3-vl:4b` new | `qwen3.8:27b-mlx` new |
| ------------------------------------ | ----------------- | ----------------- | --------------------- |
| Rows found                           | 112               | 119               | 124                   |
| Values / units agree                 | 104 / 109         | 111 / 115         | 124 / 124             |
| Ranges / flags agree                 | 95 / 108          | 102 / 115         | 122 / 124             |
| Rows the reference doesn't have      | 29                | 24                | 0                     |
| Header fields                        | 43 of 44          | 43 of 44          | 44 of 44              |
| Failed pages, retries (all 17 pages) | 0, 0              | 0, 1              | 0, 0                  |
| Time per page                        | 45 s              | 49 s              | 79 s                  |

- **`qwen3-vl:4b`:** 7 more rows found and 7 more values agree. The page with 2
  of 14 rows now has 12; two other pages lost a row or two. Values and ranges
  that disagree stayed the same (8 and 17), so the gain is in finding rows, not
  reading them. Fictional pages were unchanged at 39/39, taking 30 s a page
  instead of 22–28 s.
- **`qwen3.8:27b-mlx`:** the reference is its own reading with the old prompt,
  so this shows how much the new prompt changes a large model: all 124 rows,
  values, units and flags the same, and 2 ranges on one page read differently
  (both printed over several lines; which reading is right wasn't checked).
  Fictional pages stayed at 39/39, at 60–64 s a page instead of 55–60 s.
- **`gemma4:31b-mlx`:** run through the app's page reader, as before. With the
  old prompt 2 of 17 real pages repeated themselves (one recovered, one failed)
  and pages averaged 103 s. With the new prompt no attempt was stopped for
  repeating, no page failed or retried, and pages averaged 78 s (31–110 s,
  against 32–121 s for the pages that went cleanly before), so the time saved is
  the repeats. One clean run doesn't prove the loop is gone, but it didn't
  appear. Fictional pages stayed at 39/39, at 64–67 s a page instead of 60–66 s.
  This run counted rows, not accuracy against the reference.
- **`glm-ocr:latest` and `deepseek-ocr:latest`:** still no use with the app's
  prompt. `glm-ocr` failed the first fictional page (three invalid replies in 31
  s, against 170 s before), then wrote to the 8,192-token cap on the second;
  Ollama never closed that reply, so the page would have waited out the 10
  minute limit, and the run was stopped. (The client now gives up on a started
  reply that sends nothing for 3 minutes.) `deepseek-ocr` returned valid JSON
  with 0 of 13 rows on two pages (patient name and ID only) and failed the
  third. Their real-scan runs were skipped.

## Page resolution

The same three fictional pages, drawn at 100, 150, 200 and 300 dpi (827 × 1170
to 2481 × 3509 pixels), each read once with the current prompt and schema, one
request at a time. The 150 dpi pages are the ones used everywhere above.

| Model and dpi         | Values, ranges, flags (of 39) | Header (of 12) | Input per page | Reading the input | Time per page |
| --------------------- | ----------------------------- | -------------- | -------------- | ----------------- | ------------- |
| `qwen3-vl:4b` 100     | 38, 38, 38                    | 11             | 3,724 tokens   | 3.4 s             | 25 s          |
| `qwen3-vl:4b` 150     | 39, 39, 39                    | 11             | 4,816 tokens   | 6.5 s             | 29 s          |
| `qwen3-vl:4b` 200     | 39, 39, 39                    | 11             | 6,467 tokens   | 13.7 s            | 39 s          |
| `qwen3-vl:4b` 300     | 39, 39, 39                    | 11             | 6,699 tokens   | 15.0 s            | 42 s          |
| `qwen3.8:27b-mlx` 100 | 39, 39, 39                    | 12             | 3,709 tokens   | 11.2 s            | 58 s          |
| `qwen3.8:27b-mlx` 150 | 39, 39, 39                    | 12             | 4,892 tokens   | 17.7 s            | 68 s          |
| `qwen3.8:27b-mlx` 200 | 39, 39, 39                    | 12             | 6,543 tokens   | 28.2 s            | 82 s          |
| `qwen3.8:27b-mlx` 300 | 39, 39, 39                    | 12             | 11,327 tokens  | 66.0 s            | 120 s         |

- **Accuracy** didn't improve above 150 dpi for either model. At 100 dpi the
  large model was still perfect, but the small one misread a value, a range and
  a flag.
- **Time** grows with resolution, mostly in reading the input. Each model wrote
  the same reply at every resolution (about 1,590 and 1,790 tokens).
- **`qwen3-vl:4b` seems to cap the image**: 300 dpi took barely more input than
  200. **`qwen3.8:27b-mlx` doesn't**: at 300 dpi a page took 11,327 of the
  16,384 context tokens and twice as long as at 150 dpi. A longer page's reply
  could run out of room.
- The app renders pages at 150 dpi, which fits these results. Scans are kept as
  the scanner made them, up to 3,508 pixels on the long side (300 dpi A4), so a
  300 dpi scan costs the large model about twice the time of a 150 dpi one.
- Clean pages only: noisy scans and photos may need more pixels than these do.

## Ideas not yet tried

1. **Two steps:** `glm-ocr` transcribes the page, then a small text-only model
   (3–4B) turns the text into the app's JSON. Loaded one after the other, memory
   stays around 3 GB.
2. **`qwen3-vl:4b` on smaller machines:** check it actually loads and keeps its
   speed on a 12 GB graphics card and an 8 GB Mac.
3. Harder pages (phone photos, skew, compression) to separate the large models.
4. **Real scans at lower resolution:** read the real scans as they are and
   shrunk to 150 dpi, to see whether a lower limit for scans (now 3,508 pixels)
   saves time without losing values on noisier pages.
