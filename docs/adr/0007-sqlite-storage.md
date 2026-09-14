# 0007. SQLite through node:sqlite

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

Imported reports must survive restarts, so the app can open straight to the
dashboard. The simplest option is the webview's `localStorage`. Deno KV is
another, which the owner hasn't used and wants to try.

- **localStorage:** Deno Desktop serves the page on a new port every launch, and
  browser storage is keyed by address, so saved data would vanish.
- **Deno KV:** a value is capped at 64 KB, and one report with its page readings
  is already 45–88 KB. Splitting reports across keys would work, but isn't
  future-proof.

## Decision

- Store everything in SQLite through Deno's built-in `node:sqlite`, on the Deno
  side, in the OS app-data folder.
- Tables: `patients`, `reports` (original upload plus upgraded report),
  `results` (one row per result, for fast chart queries) and `settings`.
- Synchronous access (`DatabaseSync`): one local user, simple transactions.

## Options considered

- **Webview localStorage:** lost on restart.
- **Deno KV:** 64 KB value limit; ties the data to Deno.
- **JSON files in a folder:** no transactions, no queries across reports.

## Consequences

- No size limits, real transactions, and queries across patients and reports.
- SQLite is portable: Bun and Node have it too, so leaving Deno later would be
  easier.
- Settings live in SQLite as well, since browser storage doesn't persist.
- Schema changes follow [ADR 0004](0004-versions-stay-at-1-until-release.md).
