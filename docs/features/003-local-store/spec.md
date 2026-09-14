# 003. Local store: spec

## Problem

Imported reports must survive restarts, belong to the right person, and stay
upgradeable. Charts need fast access to every result of a test across reports.

## User stories

- As a user, when I reopen the app my reports are still there.
- As a carer, reports for different people are kept apart automatically.
- As a user, I'm warned when a report looks like it belongs to someone else.
- As a user, importing the same report twice doesn't duplicate it.
- As a user, I can delete a report, or clear everything.

## Requirements

1. SQLite database in the OS app-data folder; an override for development.
2. A report is filed under a patient by normalised ID number, or by name and
   date of birth when there's no ID.
3. Warnings when an ID number matches a patient with a different name or date of
   birth, and when a new ID's name and date of birth match an existing patient.
4. The upload is stored exactly as received, next to the upgraded report;
   re-imports of identical content are reported as duplicates.
5. One row per result for chart queries, rebuilt whenever a report is upgraded.
6. On launch, reports with an older format or catalog are upgraded from their
   originals; failures are kept and marked.
7. Common wrong files (a page file, a suggestions file, a newer format) are
   refused with an explanation.
8. Settings are stored too (theme, selected patient, chart library, later the
   Ollama address and model).
9. The database has its own version; a database from a newer app is refused.

## Acceptance criteria

- Two reports with the same ID number printed differently (spaces, case) file
  under one patient.
- Deleting a patient's last report removes the patient.
- Clearing all data keeps settings.
- A development database created before a table change stops with a message
  saying to delete it.

## Out of scope

- Sync or backup.
- Editing stored results.
