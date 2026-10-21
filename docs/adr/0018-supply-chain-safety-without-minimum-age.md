# 0018. Supply-chain safety without a minimum age

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decided by:** Owner

## Context

[ADR 0009](0009-supply-chain-safety.md) set four rules for dependencies: exact
versions, a frozen lockfile, a 7-day minimum age, and no install scripts. The
age rule got in the way when flint-chart 1.0.0 came out: it couldn't be taken on
release day. Even the one-off override in development.md didn't help, because
`deno update --latest` still skipped the new version.

The other three rules already make sure nothing changes without someone choosing
it. Updates only happen when a person runs them with `--frozen=false` and
reviews the lockfile diff.

## Decision

- **Drop the minimum dependency age.** `minimumDependencyAge` is removed from
  `deno.json`.
- Keep the rest of ADR 0009 as it is:
  - **Exact versions** in `deno.json` and `app/package.json`; no ranges.
  - **Frozen lockfile:** any install that would change `deno.lock` fails until
    allowed with `--frozen=false`.
  - **No install scripts:** never pass `--allow-scripts`; `app/.npmrc` disables
    scripts and saves exact versions if npm is used anyway.
  - The update routine in [development.md](../development.md): `deno outdated`,
    `deno update --latest --frozen=false`, review `git diff deno.lock`, test,
    and commit the files together.

## Options considered

- **Keep 7 days and override per command:** the override exists, but it's extra
  friction on every early update, and it didn't work for flint-chart 1.0.0.
- **A shorter window, such as 1 day:** still blocks taking a release the day it
  ships.

## Consequences

- New versions can be used as soon as they're published, including the major
  releases this app waits on, such as Flint's.
- There's no longer a buffer for a bad release to be caught and pulled before
  it's installed. Updates are still deliberate, so the protection is now the
  lockfile review: read the changelog of a fresh release, and be suspicious of
  unexpected new packages in `git diff deno.lock`.
- Supersedes [ADR 0009](0009-supply-chain-safety.md).
