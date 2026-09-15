# 005. Dashboard: spec

## Problem

After importing reports, a person needs one screen that answers: who is this,
which reports do we have, and how has each test changed?

## User stories

- As a new user, I see a drop zone and can add report files.
- As a returning user, the app opens straight to my dashboard.
- As a carer, I switch between people, and the app remembers who I looked at
  last.
- As a user, I see each report's lab, doctor, dates and how it was read, when I
  want them.
- As a user, I find a test quickly, or show only flagged results.
- As a user, word results (urine colour, "Negative") are listed rather than
  charted.
- As a user with one report so far, I understand why there's no trend yet.

## Requirements

1. Welcome screen with a drop zone and file picker; import results explained.
2. Patient picker; the choice is remembered in settings.
3. Patient summary: name, sex and age, masked ID with a show option, report
   count and date span, labs, latest report with flagged count.
4. Reports section: collapsible report rows with provider, doctor, dates,
   extraction details, specimen notes, interpretation and extraction notes;
   remove a report.
5. Tests in their own collapsible section, showing the test and flagged counts
   when folded: search and a flagged-only filter, then the tests as cards
   grouped by catalog group, or as a table with a column per report. A table
   cell's hover text gives that report's lab range, and clicking a row opens its
   large chart. In the table, flagged-only keeps a test flagged in any report;
   cards go by the latest result.
6. Text results in their own collapsible section after Tests, filtered by the
   same search and flagged-only filter. While Tests is folded and a filter is
   on, the text results say so and offer to clear it, even when none match.
7. One-report notice explaining that trends need a second report.
8. Top bar stays in reach while scrolling; clickable things look clickable.
9. Every foldable region (Reports, each report row and its interpretation and
   extraction notes, Tests, Text results), and whether Tests shows cards or the
   table, are remembered for each patient while the app is open: switching
   patients, or visiting Settings or a review and coming back, finds them as
   they were left. A patient not yet opened starts with Reports, Tests and Text
   results open and the newest report open, with Tests as cards. Clear all data
   forgets them.

## Acceptance criteria

- With the fictional samples, Alex Tan shows four reports from two labs and Sam
  Rivera one, with the one-report notice.
- Searching "chol" shows only cholesterol tests; flagged-only hides normal ones.
- Switching Tests to Table for Alex Tan shows a column per report and each
  test's results, flagged ones marked; clicking a row opens that test's chart.
- Folding Tests brings the text results up under it; with a search still on,
  they show "Filtered in Tests" and a way to clear it.
- The dashboard loads a different patient without showing the previous one's
  data.
- Folding Tests for Alex Tan, then switching to Sam Rivera and back, or visiting
  Settings and back, shows Alex Tan's Tests still folded and Sam Rivera's open.

## Out of scope

- Charts themselves (feature 006).
- Comparing two people.
