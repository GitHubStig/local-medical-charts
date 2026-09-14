# Docs

How Medical Charts is meant to work, why it's built the way it is, and each
feature's spec, plan and tasks.

## Start here

1. [product.md](product.md): the problem, who it's for, goals and non-goals.
2. [architecture/overview.md](architecture/overview.md): the parts and how data
   moves between them.
3. [adr/](adr/): one file per significant decision.
4. [features/](features/): one folder per feature, in the order they're built.
5. [development.md](development.md): running, checks, versions during
   development and updating dependencies.

## Architecture decision records

| #    | Decision                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------- |
| 0001 | [Everything runs locally; no cloud models](adr/0001-local-only-processing.md)                      |
| 0002 | [The model transcribes, code interprets](adr/0002-model-transcribes-code-interprets.md)            |
| 0003 | [Versioned report JSON, originals kept](adr/0003-versioned-reports-originals-kept.md)              |
| 0004 | [Versions stay at 1 until release](adr/0004-versions-stay-at-1-until-release.md)                   |
| 0005 | [Deno Desktop instead of Electron](adr/0005-deno-desktop.md)                                       |
| 0006 | [Vue 3 single-file components, built with Vite under Deno](adr/0006-vue-with-vite-under-deno.md)   |
| 0007 | [SQLite through node:sqlite](adr/0007-sqlite-storage.md)                                           |
| 0008 | [Desktop bindings, one contract, a fake for the browser](adr/0008-bindings-contract-and-fake.md)   |
| 0009 | [Supply-chain safety for dependencies](adr/0009-supply-chain-safety.md)                            |
| 0010 | [Flint as the chart spec, four renderers](adr/0010-flint-chart-spec.md)                            |
| 0011 | [A small Ollama client instead of provider SDKs](adr/0011-own-ollama-client.md)                    |
| 0012 | [Review before saving; imports held in memory](adr/0012-review-before-saving-imports-in-memory.md) |
| 0013 | [Fictional data only in the repo](adr/0013-fictional-data-only.md)                                 |
| 0014 | [Prefer platform APIs](adr/0014-prefer-platform-apis.md)                                           |
| 0015 | [Build in small, reviewed steps](adr/0015-small-reviewed-steps.md)                                 |

## Features

| #   | Feature                                                                  | Status |
| --- | ------------------------------------------------------------------------ | ------ |
| 001 | [Report extraction pipeline](features/001-report-extraction/spec.md)     | Done   |
| 002 | [Report versioning and upgrades](features/002-report-versioning/spec.md) | Done   |
| 003 | [Local store](features/003-local-store/spec.md)                          | Done   |
| 004 | [Desktop shell and bindings](features/004-desktop-shell/spec.md)         | Done   |
| 005 | [Dashboard](features/005-dashboard/spec.md)                              | Done   |
| 006 | [Charts](features/006-charts/spec.md)                                    | Done   |
| 007 | [Reading settings](features/007-reading-settings/spec.md)                | Done   |
| 008 | [PDF and photo import](features/008-pdf-and-photo-import/spec.md)        | Done   |
| 009 | [Review before saving](features/009-review-before-saving/spec.md)        | Done   |
| 010 | [Reading notifications](features/010-reading-notifications/spec.md)      | Done   |

## Writing new docs

- **A new feature:** add `features/NNN-name/` with `spec.md` (what and why),
  `plan.md` (how, and which files) and `tasks.md` (small, checkable steps).
  Write the spec before code.
- **A decision someone could reasonably have made differently:** add an ADR.
  Never edit an accepted ADR's decision; supersede it with a new one.
- Keep examples fictional ([ADR 0013](adr/0013-fictional-data-only.md)).
