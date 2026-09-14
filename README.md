# Medical Charts

Chart lab results over time from printed and PDF lab reports. A vision model
running locally in Ollama reads each page, you check the reading, and every test
is charted across reports and labs. **Nothing leaves your computer.**

## What you need

- **[Deno](https://deno.com) 2.9.** It's the only thing to install: no Node.js,
  and never `npm install`, which would bypass the lockfile and pinned versions.
- **[Ollama](https://ollama.com) with a vision model**, to read PDFs and photos.
  Models that read reports well need about 18–20 GB of memory, for example
  `qwen3.8:27b-mlx`; see [the models tried](docs/ocr-models.md). Report JSON can
  be imported without Ollama.

## Getting started

```sh
deno install        # everything from deno.lock
deno task desktop   # build the app and open its desktop window
```

In the app, open **Settings**, choose a model and press **Test connection**,
then add a report. To work on the UI with fictional sample data instead, run
`deno task dev` (see [development](docs/development.md)).

| Task                           | What it does                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `deno task desktop`            | Build the app and open it in its desktop window (database in `.data/`)        |
| `deno task dev` / `build`      | Run the app in a browser on fictional data, or build it                       |
| `deno task test`               | Run the tests                                                                 |
| `deno task extract <file.pdf>` | Split a report PDF into page images (`--embedded` for scanned PDFs)           |
| `deno task ocr`                | OCR page images in `2.images` into JSON in `3.data` with a local Ollama model |
| `deno task map`                | Suggest catalog matches for test names the catalog doesn't know               |
| `deno task upgrade`            | Upgrade stored reports to the current schema version and catalog              |
| `deno task samples`            | Regenerate the fictional sample reports in `samples/`                         |

## Privacy

- Pages are read on your machine through Ollama. No cloud models, no API keys,
  no telemetry ([ADR 0001](docs/adr/0001-local-only-processing.md)).
- Uploaded PDFs and photos stay in memory until you save or discard the reading
  ([ADR 0012](docs/adr/0012-review-before-saving-imports-in-memory.md)).
- Every person, lab and result in this repo is fictional
  ([ADR 0013](docs/adr/0013-fictional-data-only.md)).

## Documentation

- [Product](docs/product.md): the problem, goals and non-goals.
- [Architecture](docs/architecture/overview.md): the parts and how data moves.
- [Decisions](docs/adr/): why it's built this way.
- [Features](docs/features/): each feature's spec, plan and tasks.
- [Development](docs/development.md): running, checks, versions and updating
  dependencies.
- [Vision models tried](docs/ocr-models.md).
