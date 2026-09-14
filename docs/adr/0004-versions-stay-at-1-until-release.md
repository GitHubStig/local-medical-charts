# 0004. Versions stay at 1 until release

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

With versioning in place ([ADR 0003](0003-versioned-reports-originals-kept.md)),
every table or format change during development (adding settings, say) would
become a new migration. Nobody has a version 1 database except the developer, so
those migrations would only be noise.

## Decision

- Until the owner declares the app released, the report `SCHEMA_VERSION` and the
  database migrations both stay at **version 1**.
- Changes edit version 1 in place: the Zod schemas, or migration 1's SQL.
- After such a change, local data is reset: delete `.data/` for the database,
  and regenerate reports for the JSON format.
- A development database created before a change fails with a message saying to
  delete it, instead of misbehaving.

## Options considered

- **Migrations from the first change:** correct for released software, but adds
  migrations for data no user has.

## Consequences

- The migration machinery exists and is tested, but only has version 1.
- Developers occasionally reset local data; the README says how.
- The first real migration (version 2) happens after release, and from then on
  shipped migrations are never edited.
