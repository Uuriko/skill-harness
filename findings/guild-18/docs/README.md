# skill-harness docs (guild-18)

Verification + documentation drop for the `Uuriko/skill-harness` repo,
produced by wave1000 guild-18 (2026-10-08) on branch `wave1000/guild-18`.
Covers the `main`-branch codebase; the wave300 replay family is documented
separately (it lives on its own branches).

## Module docs
- `module-frontmatter.md` — `lib/frontmatter.mjs`: the YAML-subset parser
  (split/parse, block scalars, comments, limits, the unclosed-quote bug).
- `module-static-checks.md` — `lib/static-checks.mjs`: the 18-check catalog,
  verdict rule, security patterns.
- `module-smoke.md` — `lib/smoke.mjs`: script-syntax, URL liveness
  (warn-only), harness-owned walkthroughs, pass rule.
- `module-results.md` — `lib/results.mjs`: result JSON, index rebuild,
  badge SVG lifecycle primitives.
- `module-harness-cli.md` — `bin/harness.mjs`: the six commands, the verify
  flow, exit-code contract.

## System docs
- `harness-flow.md` — end-to-end: skill dir → checks → smoke → result →
  index → badge, plus trust boundaries and failure modes.
- `badge-lifecycle.md` — birth, rendering, storage, serving, regeneration,
  staleness, concurrency, filename safety.
- `replay-semantics.md` — the wave300 replay harness: trace format v1,
  recorder, secret scrubber, replay gate, the broken-change demo, and
  adversarial notes.
- `gotchas.md` — 18 field notes from verification + the dead-code audit
  (verdict: no dead code; every export reachable).

## Verification findings (sibling docs in `findings/guild-18/`)
- `mutants.md` — 15 mutants: 2 killed, 13 survived (all test gaps /
  corpus-equivalences, none a shipped defect).
- `fuzz.md` — 15 hostile inputs: 12 clean; F2 unclosed-quote fail-open
  (real bug), F11 unbounded script-syntax phase (perf), F14 driver error
  (superseded by re-verify).
- `bugs.md` — confirmed bugs with repro (the F2 unclosed-quote bug).
- `reverify.md` — wave300/replay-harness family: scratch rebases onto
  current main, full suites, adversarial diff review, gate-bypass attempts.
- `repro-traversal.mjs` — badge-name traversal probe (negative: not reachable).

## Regression tests added (on this branch)
- `tests/mutant-reg-frontmatter.test.js` — literal `|` block scalar keeps
  newlines; unclosed quote rejected (fail-first for the F2 bug).
- `tests/mutant-reg-results.test.js` — 1 static fail ⇒ verdict `fail`.
- `tests/mutant-reg-static.test.js` — 1024-char description passes;
  `-bad-` name fails format.
- `tests/mutant-reg-smoke.test.js` — warn-only liveness failure stays
  non-fatal (kills M11).
- `tests/mutant-reg-cli.test.js` — `verify`/`check` exit codes via
  child process (kills M14/M15).
