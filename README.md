# Medical Charts

Chart lab results over time from scanned medical reports. A local pipeline OCRs
report PDFs with a local vision model into versioned JSON, and a desktop app
(Deno Desktop + Vue) charts every test across reports and labs.

**Deno is the only thing you need to install.** No Node.js, no npm.

## Getting started

```sh
deno install      # installs everything from deno.lock — never use npm install
deno task dev     # app in a browser with hot reload, on fictional sample data
deno task desktop # app in its desktop window
deno task build   # production build into app/dist
deno task test    # pipeline tests
```

| Task                           | What it does                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `deno task extract <file.pdf>` | Split a report PDF into page images (`--embedded` for scanned PDFs)           |
| `deno task ocr`                | OCR page images in `2.images` into JSON in `3.data` with a local Ollama model |
| `deno task map`                | Suggest catalog matches for test names the catalog doesn't know               |
| `deno task upgrade`            | Upgrade stored reports to the current schema version and catalog              |
| `deno task dev` / `build`      | Run the app in a browser, or build it                                         |
| `deno task samples`            | Regenerate the fictional sample reports in `samples/`                         |
| `deno task desktop`            | Build the app and open it in its desktop window (database in `.data/`)        |
| `deno task test`               | Run the tests                                                                 |

## Two ways to run the app

|            | `deno task dev`                                        | `deno task desktop`                            |
| ---------- | ------------------------------------------------------ | ---------------------------------------------- |
| Runs in    | A normal browser, with live reload                     | The desktop window                             |
| Data       | Fake bindings with the fictional reports in `samples/` | Real bindings, SQLite in `.data/`              |
| Use it for | UI work, and anything an AI agent needs to see quickly | Checking the real storage, import and upgrades |

Both implement the same `DesktopBindings` contract (`desktop/contract.ts`), and
the same contract tests run against both (`desktop/contract_suite.ts`), so the
fake can't quietly drift from the real thing. Add `?empty` to the dev URL to
start with no reports.

## Versions during development

Until the app is complete, everything stays at **version 1**: the report JSON
format (`SCHEMA_VERSION` in `src/schema.ts`) and the database
(`desktop/store/db-migrations.ts`). Change them in place instead of adding
migrations, then reset local data:

- **Database changed:** delete `.data/` and relaunch `deno task desktop`. An
  out-of-date development database stops with an error saying so.
- **Report format changed:** regenerate reports with
  `deno task ocr --merge-only` (or run the OCR again if page files changed),
  then re-import them.

Migrations start from version 2, after release.

## Known workarounds

### npm `zod` for the app's editor types

The pipeline uses Zod from JSR (`jsr:@zod/zod`). The VS Code Vue extension can't
resolve JSR packages, so report types imported into the app through
`src/schema.ts` would silently become `any`. As a workaround:

- `app/package.json` has npm `zod` as a **devDependency, used for types only** —
  same source repository and version as the JSR package, never bundled.
- `app/tsconfig.json` maps `@zod/zod` to it with `paths`.

**To remove it** once the Vue extension (or TypeScript) can resolve JSR
packages: delete the `paths` entry and the `zod` devDependency, run
`deno install --frozen=false`, and check that report types in a `.vue` file
still show real types rather than `any`. Keep both zod versions in step until
then.

## Dependencies and supply-chain safety

Malicious package versions (for example the Shai-Hulud npm worm) usually spread
through a freshly published patch release that installs automatically and runs
an install script. This repo is set up so that can't happen silently:

| Protection          | Where                                       | What it does                                                                                                      |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Exact versions      | `deno.json` `imports`, `app/package.json`   | No `^` or `~` ranges, so a direct dependency never moves on its own                                               |
| Lockfile            | `deno.lock`                                 | Pins every package, including indirect ones, with an integrity hash                                               |
| Frozen lockfile     | `deno.json` `"lock": { "frozen": true }`    | An install that would change `deno.lock` fails instead of updating it                                             |
| Minimum package age | `deno.json` `"minimumDependencyAge": "P7D"` | Refuses any version published less than 7 days ago; bad releases are usually caught and pulled within that window |
| No install scripts  | Deno default                                | Deno never runs npm `postinstall` scripts unless `--allow-scripts` is passed. Don't pass it                       |
| npm fallback        | `app/.npmrc`                                | If someone runs npm anyway: no install scripts, no saved ranges                                                   |

**Always install with `deno install`.** npm ignores `deno.lock`, so
`npm install` would resolve every indirect dependency afresh.

### Updating dependencies

Updates are deliberate. The trade-off for the protections above is that you run
these steps yourself:

1. **See what's newer.**
   ```sh
   deno outdated
   ```
2. **Update.** `--frozen=false` is required: it's the explicit permission to
   change `deno.lock`.
   ```sh
   deno update --latest --frozen=false             # everything
   deno update --latest --frozen=false npm:vite    # or one package
   ```
   Versions stay exact. For `app/package.json` you can also edit a version by
   hand, then run `deno install --frozen=false`.

   If you forget `--frozen=false`, the command fails _after_ already writing the
   new version into `deno.json` or `app/package.json`, leaving them out of step
   with `deno.lock`. Rerun it with `--frozen=false`, or `git checkout` the file.
3. **If a version is refused as too new**, it was published less than 7 days
   ago. Wait and try again. That refusal is the protection working.
4. **Review the lockfile diff** before committing. It shows every package that
   changed, including indirect ones you never chose.
   ```sh
   git diff deno.lock
   ```
   Be suspicious of unexpected new packages, and read the changelog of anything
   with a major version bump.
5. **Check nothing broke.**
   ```sh
   deno task test
   deno task build
   ```
6. **Commit** `deno.json`, `app/package.json` and `deno.lock` together.

### Taking a version younger than 7 days

Only for an urgent fix, such as a security patch you actually need. Override the
age rule for that one command:

```sh
deno update --latest --frozen=false --minimum-dependency-age=0 npm:some-package
```

Later installs use `deno.lock` as normal; the 7-day rule applies again to the
next update. Say in the commit message why you took a version that young.
