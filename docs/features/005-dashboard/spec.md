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
5. Test grid grouped by catalog group, with search and a flagged-only filter.
6. Text results in their own collapsible section.
7. One-report notice explaining that trends need a second report.
8. Top bar stays in reach while scrolling; clickable things look clickable.

## Acceptance criteria

- With the fictional samples, Alex Tan shows four reports from two labs and Sam
  Rivera one, with the one-report notice.
- Searching "chol" shows only cholesterol tests; flagged-only hides normal ones.
- The dashboard loads a different patient without showing the previous one's
  data.

## Out of scope

- Charts themselves (feature 006).
- Comparing two people.
