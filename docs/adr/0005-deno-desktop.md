# 0005. Deno Desktop instead of Electron

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

The app has to run locally, read files, talk to Ollama and store data, with a
web UI. Electron is the usual answer but ships its own Chromium and Node with
every app. The owner also wanted the project to show off newer tooling: Deno
2.9's `deno desktop`, which renders in the system webview and packs the app into
a small binary, with Deno as the only thing to install.

## Decision

- The app is a Deno Desktop app: `desktop/main.ts` opens the window, serves the
  built Vue app with `Deno.serve`, and exposes typed bindings.
- No Node.js and no npm, for building or running. Deno is the runtime, package
  manager, test runner, formatter and linter.

## Options considered

- **Electron:** mature, but heavy (its own Chromium and Node), and nothing new
  to learn or show.
- **Tauri:** small, but brings Rust into a TypeScript project.
- **A local web server opened in the browser:** simplest, but not an app, and
  browser storage is fragile.

## Consequences

- Small app, one runtime, one lockfile.
- The UI renders in WebKit on macOS; features must work there.
- The window's address gets a new port each launch, so browser storage doesn't
  persist ([ADR 0007](0007-sqlite-storage.md)).
- The window can't be scripted over DevTools, so UI checks run in a browser
  against fake bindings ([ADR 0008](0008-bindings-contract-and-fake.md)).
- Deno Desktop is young; packaging for release waits until the app is feature
  complete.
