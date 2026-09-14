# 0015. Build in small, reviewed steps

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

The app is built with an AI assistant writing most of the code. An assistant can
produce a whole app in one go, which leaves a single huge change nobody has
reviewed, and decisions made silently along the way. The owner wanted to learn
from the project, keep control of the decisions, and keep a clean history.

## Decision

- Plan first, then build in **numbered steps** (split into sub-steps when big).
- After each step the assistant stops, says what changed, what was verified and
  what's next. The owner reviews, commits, and says go.
- The assistant never commits, and asks when something is genuinely unclear
  instead of guessing.
- Risky unknowns get a quick test ("spike") before being built on: bundling,
  storage limits, binding payload sizes, model accuracy.
- Mockups come before screens, using Claude Design with fictional data.

## Consequences

- Many small commits, each easy to review and revert.
- Decisions surface at every stop, where the owner can change direction.
- Slower than one-shot generation, and relies on the owner reviewing each step.
- Working rules are written down for every session in `AGENTS.md`.
