# lib/results.mjs — module doc

**Purpose.** Results store + SVG badges. Everything is static files —
`results/<skill>/<version>.json`, `results/index.json`, `badges/<skill>.svg`.
No server needed; GitHub raw serves the badges.
Exports: `skillVersion`, `writeResult`, `rebuildIndex`, `badgeSvg`, `writeBadge`,
`badgeMarkdown`.

## `skillVersion(skillDir)`
`git -C <skillDir> rev-parse --short HEAD`, falling back to `"local"` on any
error. **Gotcha:** it runs against the skill dir, but git walks *up* — a skill
dir inside any repo (e.g. a scratch copy under the harness worktree) reports
the *enclosing* repo's SHA, not "local". Version collisions across skills are
possible (two skills verified from the same repo share a version string);
result files are namespaced per skill so this is benign.

## `writeResult(harnessRoot, { skill, version, staticChecks, smoke })`
- `verdict = (staticFails === 0 && (!smoke || smoke.passed)) ? "pass" : "fail"`.
  (Mutation M4: `<= 1` would let one static fail through as "pass" — untested
  before this branch's regression test.)
- Writes `results/<skill>/<version>.json` (`mkdir -p` first). Returns the
  result object. Overwrites silently on re-verify of the same version.

## `rebuildIndex(harnessRoot) -> { updated_at, skills }`
Scans `results/<skill>/*.json`, picks the latest **by file mtime**
(not by version string, not by `checked_at`), and summarizes each skill:
`verdict, version, checked_at, static_fails, static_warns, smoke_passed,
smoke_steps`. Corrupt/unparseable result files are **skipped silently**
(fuzz F5: truncated JSON + 50MB file both handled, no crash). A *directory*
named `x.json` is also skipped (fuzz F6 — `readFileSync` EISDIR is caught).
Writes `results/index.json`. **Tie-break gotcha:** equal mtimes — `>=` keeps
the *last* file in readdir order; mutation M6 (`>`) would keep the first.
Untested either way; readdir order is filesystem-dependent.

## Badges
`badgeSvg({ verdict, checkedAt, warns })`:
- state = `pass && warns>0 ? "warn" : verdict` (mutation M5: `>= 0` would paint
  every passing badge yellow — killed by the badge test).
- Colors: pass `#4c1`, warn `#a4a61d`, fail `#e05d44`, unknown `#9f9f9f`.
- Right-hand text: `verified working · <date>` / `verified · N warning(s) · <date>` /
  `checks failing · <date>` / `not verified`. All text is HTML-escaped via `esc()`.
- Shields-style flat SVG, widths estimated at ~6.2px/char (estimate, not measured).

`writeBadge(harnessRoot, skill, { verdict, checkedAt, warns })` writes
`badges/<skill>.svg`. **No filename sanitization** — but the only callers pass
`basename(skillDir)` (verify flow) or an index-validated key (badge flow, which
exits 1 before writing when the skill has no results). Fuzz F8 confirmed the
`../../` traversal is *not* reachable through the CLI.

`badgeMarkdown(skill)` returns the embed snippet pointing at
`raw.githubusercontent.com/Uuriko/skill-harness/main/badges/<skill>.svg`
(hardcoded `main` — badges generated on a branch still link `main`).

## Test coverage
`tests/harness.test.js`: badge SVG reflects verdict+date; writeResult +
rebuildIndex round-trip. This branch adds: 1-fail ⇒ verdict `fail`;
exactly-1024-char description ⇒ pass; `-bad-` name-format fail
(`tests/mutant-reg-*.test.js`).
