# 0009. Supply-chain safety for dependencies

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

The owner doesn't want dependencies updating themselves when someone runs an
install, picking up a freshly published malicious patch like the Shai-Hulud npm
worm. Findings:

- `deno.lock` pins every package with an integrity hash, and Deno doesn't run
  npm install scripts (the worm's path).
- But `^` ranges can move whenever the lockfile is regenerated, and anyone
  running `npm install` in `app/` would ignore `deno.lock` and run install
  scripts.

## Decision

- **Exact versions** in `deno.json` and `app/package.json`; no ranges.
- **Frozen lockfile:** any install that would change `deno.lock` fails until
  allowed with `--frozen=false`.
- **Minimum dependency age of 7 days** (`minimumDependencyAge: "P7D"`): bad
  releases are usually caught and pulled within that window.
- **No install scripts:** never pass `--allow-scripts`; `app/.npmrc` disables
  scripts and saves exact versions if npm is used anyway.
- The README documents the update routine:
  1. `deno outdated`
  2. `deno update --latest --frozen=false`
  3. review `git diff deno.lock`, test, and commit the files together.

## Options considered

- **Rely on the lockfile alone:** covers normal installs, not regeneration or
  npm.
- **A longer age window:** safer, but slower to take real fixes; 7 days was the
  agreed balance, with a documented one-off override for urgent patches.

## Consequences

- Dependencies never change silently; updates are a deliberate, reviewed step.
- New versions can't be used for a week.
- Fast-moving packages are a poor fit; provider SDKs were rejected partly for
  this ([ADR 0011](0011-own-ollama-client.md)).
