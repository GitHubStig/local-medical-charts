# Rebuild benchmark

- **Status:** Parked by the owner.

Hand a new AI model `docs/` in an empty repo and compare what it builds against
this repo.

- **Missing from `docs/` today:** the report JSON format, the analyte catalog,
  the reading prompt, the full bindings contract, the samples and exact
  versions. Provide these as fixed files rather than let each model invent them.
- **Include:** the design mockups, so every model has the same target. They're
  no longer in the repo; restore them with `git checkout 30253b8 -- design`.
- **Keep back:** the screenshots (they're the answer), stored with the grading
  pack.
- **Grading:** unit tests can't be reused as they are. Turn their behaviour into
  hidden outside-in tests: merged report JSON on fictional pages, and the
  contract suite against a fixed `DesktopBindings`. Add a scorecard from each
  spec's acceptance criteria.
- **Watch:** a public repo can leak into training data; the docs hint at
  solutions (plans name files); `AGENTS.md` gotchas are hints too; grade without
  a live Ollama.
- **First step when resumed:** a gap audit of what a rebuild needs that `docs/`
  doesn't pin down.
