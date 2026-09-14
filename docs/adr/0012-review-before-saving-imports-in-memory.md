# 0012. Review before saving; imports held in memory

- **Status:** Accepted
- **Date:** 2026-09-14
- **Decided by:** Owner (review, discard originals), assistant (in-memory
  design)

## Context

Reading PDFs and photos in the app means a model's reading of medical values
becomes stored data. Models misread digits, and a wrong value in a chart looks
as real as a right one. Uploaded files are also sensitive personal data.

## Decision

- **A person reviews every reading before it's saved:** the results beside the
  page image, where the report will be filed, and anything worth checking.
- **Uploaded files are never written to disk.** Page images, readings and merged
  reports live in memory until saved or discarded.
- Quitting the app forgets unfinished imports; a retry after a failure or cancel
  keeps the pages already read.

## Options considered

- **Save straight after reading:** faster, but misreads go unnoticed.
- **Keep uploaded originals in the data folder:** more personal data at rest.
- **A SQLite cache of page readings, so a restart doesn't redo work:** it would
  store unreviewed readings at rest, contradicting "nothing is saved until you
  review it".

## Consequences

- Misreads are caught before they reach a chart.
- Closing the app mid-read loses that work.
- The review screen also spots a report that's probably already saved (same
  patient, lab and collection time), which content hashes can't, because every
  reading has its own timestamps.
