# Development

How to run, check and update the project day to day. Why it's set up this way is
in the ADRs linked from each section.

## Two ways to run the app

|            | `deno task dev`                                        | `deno task desktop`                            |
| ---------- | ------------------------------------------------------ | ---------------------------------------------- |
| Runs in    | A normal browser, with live reload                     | The desktop window                             |
| Data       | Fake bindings with the fictional reports in `samples/` | Real bindings, SQLite in `.data/`              |
| Use it for | UI work, and anything an AI agent needs to see quickly | Checking the real storage, import and upgrades |

Both implement the same `DesktopBindings` contract (`desktop/contract.ts`), and
the same contract tests run against both (`desktop/contract_suite.ts`), so the
fake can't quietly drift from the real thing
([ADR 0008](adr/0008-bindings-contract-and-fake.md)). Add `?empty` to the dev
URL to start with no reports.

## Checks

Before a change is done:

```sh
deno fmt
deno lint
deno task test
deno task build
deno task classes
```

`deno task classes` runs the same check as the Tailwind VS Code extension's
`suggestCanonicalClasses` warning over every `.vue` file (see
[Styling](#styling)); `deno task classes --write` rewrites what it finds.

## Styling

The app uses Tailwind 4 ([ADR 0006](adr/0006-vue-with-vite-under-deno.md)).
Class names are written in Tailwind's canonical form, the one the Tailwind VS
Code extension suggests:

- **Sizes and spacing use the spacing scale.** `--spacing` is 0.25rem (4 px), so
  880 px is `max-w-220`, 38 px is `h-9.5` and 3 px is `p-0.75`. To turn pixels
  into a scale value, divide by 4.
- **Brackets only when nothing else fits**, such as `text-[13px]` (between
  `text-xs` and `text-sm`) or `rounded-[9px]`.
- **Current names, not older aliases**: `wrap-break-word`, not `break-words`.

The root font size is left at the browser default, so scale values map to pixels
exactly.

## Local data

`.data/` holds everything real on this machine. Git ignores everything in it
except an empty `.gitkeep`, so the folder exists in a fresh clone.

| Path                                      | What it is                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.data/medical-charts.db`, `-wal`, `-shm` | The desktop app's database during development (`MEDICAL_CHARTS_DATA_DIR=.data` in the `desktop` task). A packaged app uses the OS app-data folder instead, e.g. `~/Library/Application Support/Local Medical Charts`. |
| `.data/pipeline/reports/`                 | Report PDFs for the command-line pipeline                                                                                                                                                                             |
| `.data/pipeline/images/`                  | Page images from `deno task extract`                                                                                                                                                                                  |
| `.data/pipeline/readings/`                | Page readings and merged reports from `deno task ocr`                                                                                                                                                                 |

- **Resetting the database:** quit the app, then delete `medical-charts.db`
  together with its `-wal` and `-shm` files. The `-wal` file can hold most of
  the recent changes, so never delete one without the others.
- **Don't delete all of `.data/` to reset:** that also deletes the pipeline's
  reports and readings.
- Everything here is real personal data; see the rules in `AGENTS.md` and
  [ADR 0013](adr/0013-fictional-data-only.md).

## Versions during development

Until the app is complete, everything stays at **version 1**: the report JSON
format (`SCHEMA_VERSION` in `src/schema.ts`) and the database
(`desktop/store/db-migrations.ts`). Change them in place instead of adding
migrations, then reset local data
([ADR 0004](adr/0004-versions-stay-at-1-until-release.md)):

- **Database changed:** delete the development database (see
  [Local data](#local-data)) and relaunch `deno task desktop`. An out-of-date
  development database stops with an error saying so.
- **Report format changed:** regenerate reports with
  `deno task ocr --merge-only` (or run the OCR again if page files changed),
  then re-import them.

Migrations start from version 2, after release.

## Dependencies and supply-chain safety

Malicious package versions (for example the Shai-Hulud npm worm) usually spread
through a freshly published patch release that installs automatically and runs
an install script. This repo is set up so that can't happen silently
([ADR 0009](adr/0009-supply-chain-safety.md)):

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

## Known workarounds

### npm `zod` for the app's editor types

The pipeline uses Zod from JSR (`jsr:@zod/zod`). The VS Code Vue extension can't
resolve JSR packages, so report types imported into the app through
`src/schema.ts` would silently become `any`
([ADR 0006](adr/0006-vue-with-vite-under-deno.md)). As a workaround:

- `app/package.json` has npm `zod` as a **devDependency, used for types only**,
  from the same source repository and version as the JSR package, and never
  bundled.
- `app/tsconfig.json` maps `@zod/zod` to it with `paths`.

**To remove it** once the Vue extension (or TypeScript) can resolve JSR
packages: delete the `paths` entry and the `zod` devDependency, run
`deno install --frozen=false`, and check that report types in a `.vue` file
still show real types rather than `any`. Keep both zod versions in step until
then.
