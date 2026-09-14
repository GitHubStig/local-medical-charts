# 007. Reading settings: plan

## Approach

Settings extend the existing settings table (version 1 in place). A small Ollama
service on the Deno side lists models and runs the test
([ADR 0011](../../adr/0011-own-ollama-client.md)); its wording is shared with
the browser fake.

## Modules

| File                                                                               | Role                                                                        |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `desktop/settings.ts`                                                              | `ollamaHost` (normalised to an origin), `ocrModel`                          |
| `desktop/ocr/ollama.ts`                                                            | `/api/version`, `/api/tags`, `/api/show` capabilities; the three-step test  |
| `desktop/ocr/test-image.ts`, `simple-pdf.ts`                                       | A fictional one-line report drawn with mupdf, so no image file is committed |
| `desktop/ocr/messages.ts`                                                          | Test wording shared with the fake                                           |
| `app/src/views/SettingsView.vue`, `components/OcrSettings.vue`, `DataSettings.vue` | The page                                                                    |
| `app/src/composables/useOcrSettings.ts`, `lib/ocr-settings.ts`, `lib/route.ts`     | State, dropdown options, hash routes                                        |

## Spikes before building

- mupdf (WebAssembly) runs inside the desktop app.
- Bindings carry 50 MB payloads, and the webview decodes WebP.
- Candidate vision models compared on fictional rendered pages
  ([ocr-models.md](../../ocr-models.md)).
