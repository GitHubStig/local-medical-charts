# 004. Desktop shell and bindings: plan

## Approach

Deno Desktop for the window ([ADR 0005](../../adr/0005-deno-desktop.md)), Vue 3
SFCs built by Vite under Deno
([ADR 0006](../../adr/0006-vue-with-vite-under-deno.md)), bindings rather than
HTTP with a fake for the browser
([ADR 0008](../../adr/0008-bindings-contract-and-fake.md)).

## Modules

| File                                                   | Role                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `desktop/main.ts`                                      | Window, database, launch upgrade, `win.bind` for each binding, serve `app/dist` |
| `desktop/contract.ts`                                  | `DesktopBindings` and the data types that cross                                 |
| `desktop/bindings.ts`                                  | Handlers over the store; argument checks; `unavailableBindings`                 |
| `desktop/contract_suite.ts`                            | Shared behaviour tests                                                          |
| `app/src/api/index.ts`                                 | Real bindings in the window, the fake in a browser (development only)           |
| `app/src/api/fake-bindings.ts`                         | In-memory implementation with the same wording as the real one                  |
| `scripts/generate-samples.ts`                          | Fictional reports from two fictional labs, through the real merge               |
| `app/src/composables/useTheme.ts`                      | System / light / dark, stored in settings                                       |
| `app/src/components/Icon.vue`, `app/src/assets/icons/` | SVG icon set; `desktop/icons_test.ts` checks it                                 |

## Setup

- `deno.json` workspace with `app/` and `desktop/`; tasks for dev, build,
  desktop, test.
- Dependencies pinned and aged
  ([ADR 0009](../../adr/0009-supply-chain-safety.md)).
- Design first: a Claude Design canvas with fictional data for every screen.
