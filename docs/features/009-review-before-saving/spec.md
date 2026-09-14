# 009. Review before saving: spec

## Problem

A model's reading of medical values can be wrong in ways that look perfectly
plausible in a chart. Every reading has to be checked by a person against the
page before it becomes stored data, and it has to be clear where the report will
be filed.

## User stories

- As a user, I compare each extracted result with the page image.
- As a user, I see which patient the report will be added to, and why (ID
  number, or name and date of birth), before saving.
- As a user, I'm warned when the report looks already saved, or the identity
  doesn't match.
- As a user, results the model itself was unsure about are marked for checking.
- As a user, I save the report, or discard it and its files.

## Requirements

1. Review screen at `#/review/:id`, reached from a ready import.
2. Filing banner: existing patient (and how it matched), new patient, or can't
   be saved (no identity read); identity warnings; a similar saved report (same
   patient, lab and collection time).
3. Page viewer with previous and next; choosing a result turns to its page.
4. Details as read: patient (in full, so an ID misread is visible), lab, dates,
   doctor.
5. Results table: test and page, value and unit, lab range, flag, catalog match
   or "not in the catalog"; "check the page" when an extraction note mentions
   the test.
6. Extraction notes listed.
7. Save files the report and shows it on the dashboard; discard (confirmed)
   forgets it; an import that's gone explains itself.

## Acceptance criteria

- Importing the same report twice shows the "already saved" warning on the
  second review.
- Save is disabled when no patient identity was read.
- Saving returns to the dashboard with the new report and a summary.

## Out of scope

- Editing a result before saving.
- Highlighting a result's position on the page (the model doesn't return
  positions).
