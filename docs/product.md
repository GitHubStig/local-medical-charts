# Product: Medical Charts

## The problem

Lab results arrive as printed sheets. Each checkup gives you a few pages with
that day's numbers and nothing else: no history, no trend. People also go to
different clinics and labs over the years, and every lab prints its report
differently. The same test has different names ("Total WBC", "White Cell
Count"), different units (g/dL, g/L) and different reference ranges.

Doctors see every result from every visit on one screen. Patients get a pile of
paper. Getting the same view today means typing numbers into a spreadsheet, or
uploading health records to someone else's server.

## What it does

Medical Charts turns those printed reports into one place that shows every
result over time, across labs, entirely on your own computer.

1. **Add reports.** Drop in a PDF or photos of the pages (or report JSON from
   the command-line pipeline).
2. **The computer reads them.** A vision model running locally in Ollama
   transcribes each page into structured data.
3. **You check the reading.** Before anything is saved, you see the extracted
   results beside the page image and confirm them.
4. **See the history.** Each test gets a chart of every result over time, with
   each lab's reference range, flags for abnormal values, and results from
   different labs lined up by the same test.

## Who it's for

- **People who keep their own lab reports** and want to see trends across years
  and labs without handing their data to anyone.
- **Carers** keeping track of a family member's results (several people can be
  kept apart in one app).
- **Developers** interested in local AI, desktop apps with Deno, or a charting
  layer that isn't tied to one library. The repo is also a public showcase.

## Goals

- Every result from every report, charted over time, per person.
- Results from different labs line up when they're the same test, including unit
  conversion; different tests are never merged by a guess.
- The original numbers are never altered: what the lab printed is kept and
  shown.
- Reading a report is private: no network access beyond the local Ollama server.
- A person confirms every machine reading before it's saved.
- Reports saved today still work after the app learns new report layouts.
- Runs on an ordinary Mac without Node, Docker or a cloud account.

## Non-goals

- **Medical advice.** The app shows what the lab printed. Reference ranges are
  the lab's, not targets, and nothing interprets results for you.
- **Cloud processing or sync.** No accounts, no upload, no cloud OCR.
- **Connecting to providers' systems.** Reports come from paper or PDFs, not
  from clinic or lab servers.
- **Editing results in the app.** A misread report is discarded and read again,
  or corrected in the pipeline.
- **Supporting every report layout on day one.** New layouts are handled by
  growing the analyte catalog, not by special cases in code.

## Principles

1. **Local and private by default.** Health data never leaves the machine.
2. **The model reads; code decides.** Transcription is the model's only job;
   parsing, flags, units and matching are deterministic code.
3. **Keep the original.** Stored reports keep exactly what was read, so they can
   be re-processed as the app improves.
4. **A person checks.** Machine readings of medical values are confirmed before
   they count.
5. **Few, pinned dependencies.** Prefer the platform; every package is a risk.

## Constraints

- **Hardware:** vision models good enough for lab reports need roughly 18–20 GB
  of memory today. Smaller models are close but not yet as reliable (see
  [ocr-models.md](ocr-models.md)).
- **Speed:** a page takes about a minute to read on a fast Mac. Reading happens
  in the background while the app stays usable.
- **Platform:** macOS first. Deno Desktop also targets Windows and Linux, which
  are untested.

## Success looks like

- Adding a year of reports from two labs produces charts where the same test
  from both labs sits on one line, in one unit, with each lab's range.
- A misread value is caught at review, not discovered later in a chart.
- A report saved months ago still opens after the catalog or format changes.
- Someone cloning the repo runs the app with Deno and nothing else.

## Later, maybe

- Packaged releases for download.
- Comparing two people's results side by side.
- Per-model reading prompts, and support for smaller models.
