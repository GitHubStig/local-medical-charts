# 0011. A small Ollama client instead of provider SDKs

- **Status:** Accepted
- **Date:** 2026-09-14
- **Decided by:** Owner and assistant together

## Context

Reading pages inside the app needs a model client. Could a package handle
providers instead of writing one? Checked before deciding:

- The Vercel AI SDK published hundreds of releases in 90 days and pulls in a
  hosted gateway package.
- The `openai` package is 17 MB with optional peers.
- With exact pins and a 7-day minimum age
  ([ADR 0009](0009-supply-chain-safety.md)), fast-moving SDKs would always be
  behind and churn the lockfile.
- Only two calls are needed: list models, and send an image with a JSON schema.

## Decision

- A fetch-based client for **Ollama's native API** (`src/ollama.ts`), shared by
  the command-line pipeline and the app. The native API sets the context size,
  turns thinking off, and reports which models read images.
- The Zod schema goes as Ollama's `format`; replies are validated again and
  retried with the errors fed back.
- An OpenAI-compatible adapter (for LM Studio) only if it's needed later.

## Options considered

- **Vercel AI SDK / openai package:** less code to write, far more to trust and
  update.

## Consequences

- A couple of hundred lines to own, and no dependency churn.
- Model quirks are handled in one place: replies are streamed and capped at
  8,192 tokens, stopped as soon as they repeat themselves, and read from
  `thinking` when a model's template puts the reply there.
