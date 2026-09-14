# 0003. Versioned report JSON, originals kept

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner (requirement), assistant (design)

## Context

Only two lab layouts are known so far, and they already differ a lot. What
happens to reports already saved in the database when the format or parsing
improves for a new variant? The owner wants the JSON to carry a version that can
be detected and upgraded.

"A change" means three different things:

| What changed         | Example                                 | How old reports catch up        |
| -------------------- | --------------------------------------- | ------------------------------- |
| The JSON format      | A field renamed or restructured         | Migrations, version by version  |
| The catalog or merge | New aliases, a unit factor, a flag rule | Re-merge from the page readings |
| The reading prompt   | Better transcription of a layout        | Only a new reading can fix it   |

## Decision

- Every page file and report carries `schemaVersion` (starting at 1).
- Every report **embeds the page readings** it was merged from, so it can be
  re-merged without the model.
- Migrations live in `src/migrations/` as pure functions (JSON in, JSON out),
  each with a test on a small fictional report in the old format.
- The store keeps **the upload exactly as received** next to the upgraded
  version. On launch, a report with an older version or a different catalog hash
  is upgraded again from its original, in a transaction.
- A report that fails to upgrade is kept and marked failed, never deleted.
- A file from a newer version than the app knows is refused with a clear
  message.
- The database's own tables have a separate version (`PRAGMA user_version`).

## Options considered

- **Store only the merged result:** catalog improvements could never reach saved
  reports.
- **Upgrade in place, overwriting:** a bad migration would destroy data.
- **Start existing files at version 0 with a 0→1 migration:** proposed as a
  learning example; the owner preferred making the current format version 1.

## Consequences

- Reports roughly double in size (they carry their pages); fine for SQLite.
- Catalog edits reach every saved report on the next launch.
- `deno task upgrade` does the same for JSON files on disk.
- Prompt changes are recorded (`promptHash`) but can only be fixed by reading
  again.
