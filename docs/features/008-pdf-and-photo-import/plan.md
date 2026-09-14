# 008. PDF and photo import: plan

## Approach

An in-memory queue on the Deno side turns uploads into page images, reads them
with the shared Ollama client, and merges them into a report that waits for
review. The page follows along by asking for the import list every second while
anything is reading.

## Modules

| File                                                                                                 | Role                                                                        |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `desktop/imports/file-types.ts`                                                                      | Recognise PDF, PNG, JPEG, WebP from their first bytes                       |
| `desktop/imports/sources.ts`                                                                         | Pages from an upload: scan detection with a mupdf device, rendering, photos |
| `desktop/imports/queue.ts`                                                                           | One import at a time; cancel, retry, discard, review, page images           |
| `desktop/imports/reader.ts`                                                                          | A page read through `src/ollama.ts`, errors worded for people               |
| `desktop/imports/packed-files.ts`                                                                    | Files as names and sizes plus one byte array, for the binding               |
| `desktop/imports/messages.ts`                                                                        | Wording shared with the fake                                                |
| `app/src/lib/uploads.ts`, `import-jobs.ts`, `import-toast.ts`                                        | Sorting picked files, panel wording, card wording                           |
| `app/src/composables/useImports.ts`, `useActivity.ts`                                                | Import state and polling; progress                                          |
| `app/src/components/ImportsPanel.vue`, `PhotoOrderDialog.vue`, `ProgressLine.vue`, `ImportToast.vue` | The UI                                                                      |

## Risks planned for

- **Binding payloads:** tested up to 50 MB before building.
- **Slow pages:** background reading, one at a time, cancellable.
- **Misreads:** review before saving (feature 009).
