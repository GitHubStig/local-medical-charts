# 008. PDF and photo import: spec

## Problem

Asking people to run a command-line pipeline to get report JSON is a barrier.
They should drop in the PDF or photos they already have, keep using the app
while pages are read, and understand what's happening, since a page can take a
minute.

## User stories

- As a user, I drop a PDF, and it starts being read in the background.
- As a user, I photograph a report's pages, put them in order, and read them as
  one report (or one report per photo).
- As a user, I see which report is being read, which page, and how long it's
  taken, and I can cancel, retry or remove it.
- As a user, I know right away when a file can't be read, and why.
- As a user, after adding files I get a clear summary that doesn't push the page
  around.

## Requirements

1. Accepted: PDF, JPG, PNG, WebP and report JSON. File types are recognised by
   their bytes. HEIC and oversized files are refused with a reason.
2. Each PDF is one report. A page that is one upright full-page scan is sent as
   the scanner's own image; other pages are rendered.
3. Photos added together open an order dialog with thumbnails, reordering, and
   "each photo is its own report".
4. One import reads at a time; others wait. Cancel keeps pages already read;
   retry continues from there; a different model reads again.
5. Nothing is written to disk until review
   ([ADR 0012](../../adr/0012-review-before-saving-imports-in-memory.md)).
6. An imports panel shows each import's status, progress and actions.
7. A thin progress line shows files being read and handed over.
8. A floating results card summarises what was added (patient, date, lab, result
   count), closes itself after a countdown that pauses on hover, and stays open
   when something needs attention.
9. Failures are worded for people: no model chosen, Ollama unreachable, model
   not installed, took too long, kept repeating itself.
10. Closing the window quits the app. If a reading is waiting, being read or
    ready to review, it asks first, since quitting forgets it.

## Acceptance criteria

- A scanned PDF's pages reach the model as the original JPEGs.
- Three photos named IMG_2, IMG_9, IMG_10 are offered in that order.
- A model that repeats itself is stopped within a few minutes with a clear
  message, not after a ten-minute timeout.
- Adding files never moves the page content.

## Out of scope

- Keeping uploads or readings across restarts.
- System notifications ([feature 010](../010-reading-notifications/spec.md)).
