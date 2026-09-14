# 002. Report versioning and upgrades: spec

## Problem

New lab layouts will keep turning up. Supporting them changes the report format,
the catalog or the merge code. Reports already saved must keep working and
benefit from the improvements, without reading the pages again.

## User stories

- As the owner, a report I saved months ago still opens after the app changes.
- As the owner, when the catalog learns a new test name, my existing reports
  pick it up automatically.
- As the owner, a bad upgrade can be fixed and re-run without losing data.

## Requirements

1. Every page file and merged report carries a whole-number `schemaVersion`,
   starting at 1.
2. A merged report embeds the page readings it was built from.
3. Migrations upgrade old JSON one version at a time; each is a pure function
   with a test.
4. `upgradeReport` migrates, then re-merges when a migration ran, the catalog
   hash changed, the stored report no longer validates, or a re-merge is forced.
5. JSON from a newer version than the app knows is refused with a clear message.
6. `deno task upgrade` upgrades report files on disk the same way.
7. While in development, the format stays at version 1
   ([ADR 0004](../../adr/0004-versions-stay-at-1-until-release.md)).

## Acceptance criteria

- A report merged with an older catalog is re-merged with the current one, and a
  newly known test becomes matched.
- A synthetic old-format report upgrades to the current format and validates.
- Upgrading an up-to-date report changes nothing.
- A report from a future version produces a message saying to update the app.

## Out of scope

- Fixing a report whose problem is the reading itself (needs a new reading).
- The database's own table versions (feature 003).
