# 0001. Everything runs locally; no cloud models

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

The app reads medical reports: names, ID numbers, dates of birth and results.
The owner treats those files as sensitive personal data that must not be used
for training. For reading PDFs, the obvious shortcut is a cloud vision model
(Gemini Flash, an OpenAI-compatible cloud API), which would be faster and more
accurate than anything that runs on a laptop. Some free tiers use submitted
content to improve their models.

## Decision

- All reading happens on the same machine, through a local Ollama server.
- No cloud providers, no API keys, no telemetry.
- The only network traffic is to the Ollama address set in Settings (localhost
  by default).

## Options considered

- **Cloud vision models:** better and faster, but health records would leave the
  machine, and training on submissions can't be ruled out. Rejected.
- **Cloud as an opt-in with warnings:** still means storing API keys and a
  consent flow for sensitive data. Not worth the complexity for this app.
- **An OpenAI-compatible adapter for local servers (LM Studio):** fits the rule,
  deferred until the owner uses LM Studio.

## Consequences

- Good readings need a large vision model (~18–20 GB of memory) and about a
  minute per page; smaller models are close but not yet as reliable
  ([ocr-models.md](../ocr-models.md)).
- Reading runs in the background with progress, and the app stays usable.
- No secrets to store or leak.
