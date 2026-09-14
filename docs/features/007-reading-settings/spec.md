# 007. Reading settings: spec

## Problem

Reading PDFs and photos inside the app (feature 008) needs a local Ollama server
and a vision model. People need to point the app at Ollama, pick a model that
can read images, and know it works before waiting minutes for a report.

## User stories

- As a user, I set the Ollama address, pick a model, and see which models can
  read images.
- As a user, I press Test connection and learn whether Ollama is running, the
  model is installed, and it can actually read an image.
- As a user, destructive actions like clearing all data are out of the way.

## Requirements

1. A Settings page at `#/settings`, reached from a gear in the top bar and on
   the welcome screen.
2. Ollama address: saved on change, validated as an http(s) address.
3. Model dropdown listing installed models as "reads images" or "text only";
   text-only models can't be picked; refresh; a saved model that's gone is
   shown.
4. Test connection in three steps, stopping at the first failure, each explained
   in plain words: reachable, installed, reads a small generated test image.
5. Clear all data moves here from the top bar.
6. No cloud providers or API keys
   ([ADR 0001](../../adr/0001-local-only-processing.md)).

## Acceptance criteria

- With Ollama stopped, the test says it couldn't reach Ollama and to check it's
  running.
- A text-only model can't be selected, and testing one says it can't read
  images.
- The browser version shows the same wording, from a fictional model list.

## Out of scope

- Editing the reading prompt (later, per model).
- Other local servers such as LM Studio (later, if used).
