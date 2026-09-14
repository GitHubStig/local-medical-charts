# 0008. Desktop bindings, one contract, a fake for the browser

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner (bindings), assistant (contract and fake)

## Context

The page needs data from the Deno side. The assistant recommends a small HTTP
API on the same `Deno.serve`: one code path for the window, a browser and tests,
and easy to try with `curl`. The owner already knows HTTP APIs well, but hasn't
used Deno Desktop's bindings (`win.bind()`, called from the page as
`bindings.name()`), and the project is meant for learning.

## Decision

- The page talks to Deno through **bindings**, not HTTP.
- One TypeScript type, `DesktopBindings` in `desktop/contract.ts`, is the
  contract on both sides; every binding returns a Promise.
- In `deno task dev` (a normal browser), **fake bindings** implement the same
  contract in memory with fictional samples.
- **One contract test suite** runs against both the real SQLite bindings and the
  fake, so the fake can't drift.

## Options considered

- **HTTP API:** familiar and testable with `curl`, but misses the point of
  learning Deno Desktop.

## Consequences

- Fast UI development in a browser with live reload, on realistic fake data.
- Every new binding needs a fake implementation and shared tests.
- Data crosses as JSON. A `Uint8Array` survives only as an argument of its own
  or in a result; nested inside an object it becomes a plain object, so uploads
  send `startImport(files, bytes)`.
- The real window can't be scripted, so desktop-only behaviour is checked with a
  small desktop app over the real bindings.
