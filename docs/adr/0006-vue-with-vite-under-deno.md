# 0006. Vue 3 single-file components, built with Vite under Deno

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner, after trying the alternative

## Context

The owner wanted the latest Vue 3, and first preferred bundling with Deno alone:
one less dependency, and Deno would keep catching up. Checking that against
reality:

- `deno bundle` is experimental, has no plugins and **can't compile `.vue`
  files**.
- Vue in TSX bundled fine but failed type-checking under every Deno JSX setting.
- There was no live reload of the UI during development.

The owner also wanted Tailwind, VueUse, and components written as
`<script setup>` single-file components, because they're easier to review and
change later.

## Decision

- Vue 3 `<script setup>` SFCs, Tailwind 4 and VueUse.
- Built by **Vite 8**, which runs under Deno (`deno task dev`,
  `deno task build`). Deno stays the runtime and package manager; Vite only
  compiles the frontend.

## Options considered

- **Deno-only bundling with template strings:** type-checks and renders, but no
  SFCs, a bigger bundle and no live reload.
- **Deno-only with TSX or render functions:** less readable for a showcase, and
  TSX didn't type-check.

## Consequences

- Normal Vue development: SFCs, hot reload, Tailwind.
- One more toolchain dependency (pinned,
  [ADR 0009](0009-supply-chain-safety.md)).
- `vue-tsc` can't run under Deno, so `.vue` files are type-checked by the VS
  Code Vue extension, and TypeScript modules with `tsc`.
- npm `zod` is a types-only dev dependency so the editor can see report types
  (the README explains how to remove it later).
