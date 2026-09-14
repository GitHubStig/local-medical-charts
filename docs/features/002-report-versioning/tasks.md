# 002. Report versioning and upgrades: tasks

- [x] Add `schemaVersion` (1) to page files and merged reports
- [x] Embed each report's page readings in `pages`
- [x] Keep `SCHEMA_VERSION` in an import-free module for browser use
- [x] Migration framework: ordered list, numbering check, pure functions
- [x] `upgradeReport`: migrate, re-merge on migration / catalog change / invalid
      report / force, validate
- [x] Refuse JSON from a newer version with an actionable message
- [x] `deno task upgrade` for report files on disk
- [x] Tests: up-to-date report unchanged, catalog change re-merges, newer
      version refused
- [x] Document how to add a migration after release, and the
      version-1-in-development rule in the README
