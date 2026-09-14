# 004. Desktop shell and bindings: spec

## Problem

The pipeline and store need an app around them: a desktop window with a web UI,
a typed way for the page to reach the Deno side, and a fast way to develop the
UI without real data.

## User stories

- As a user, I open one app, with nothing else to install but Deno.
- As a developer, I can work on the UI in a browser with live reload, on
  realistic fictional data.
- As a developer, I can trust the browser version behaves like the real one.
- As a user, the app follows my system's light or dark mode, or I can choose.

## Requirements

1. `deno task desktop` builds the Vue app and opens it in a Deno Desktop window.
2. One `DesktopBindings` type is the contract for both sides.
3. The window opens even when the database can't; the page explains why.
4. `deno task dev` runs the app in a browser against fake bindings loaded with
   fictional samples; `?empty` starts with none.
5. One contract test suite runs against the real and fake bindings.
6. Fictional sample reports are generated through the real pipeline.
7. Theme: system, light or dark, remembered.
8. Icons are SVG files rendered by one component, checked by a test.

## Acceptance criteria

- The same contract tests pass for both implementations.
- A database error shows its message and path in the window instead of a blank
  page.
- Switching theme applies immediately and survives a restart.

## Out of scope

- Packaging releases (deferred).
