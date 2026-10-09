# lib/smoke.mjs — module doc

**Purpose.** Smoke tests: actually *exercise* the skill instead of just reading it.
Exports: `runSmoke(skillDir, { skillName, harnessRoot, timeoutMs = 120000 }) -> { steps, passed }`.

## Two layers

**Layer 1a — bundled scripts parse** (`checkScript`). Every `.mjs/.js/.cjs/.sh/.py`
file in `<skill>/scripts/` and `<skill>/` (top level only, non-recursive) is
syntax-checked: `node --check`, `bash -n`, `python3 -m py_compile`, each with a
15s timeout. One step per script: `script-syntax: <basename>`.

**Layer 1b — URL liveness** (`urlLiveness`). Extracts `http(s)://` URLs from
SKILL.md (max 25), skipping templated (`{`, `<`, `*`, `example.com`, `...`, `…`)
and localhost URLs. For each: HEAD then GET, 8s abort timeout per attempt,
`ok = status < 500`. **All liveness steps are `warnOnly: true`** — the open web
flakes, so a dead link is recorded but never fatal.

**Layer 2 — harness-owned walkthrough** (`runWalkthrough`). If
`<harnessRoot>/smoke-scripts/<skillName>.smoke.mjs` exists, it is executed as
a child `node` process with `HARNESS_SKILL_DIR` set and a `timeoutMs` budget
(default 120s, `maxBuffer` 4MB). The script emits `PASS <name>[: detail]` /
`FAIL <name>[: detail]` lines; each becomes a `walkthrough: <name>` step.
Zero PASS/FAIL lines → one failing `walkthrough` step with the error/stderr.
**Walkthrough scripts are harness-owned, never skill-owned** — a skill must not
ship its own passing test.

## Pass rule
```js
const fatalFails = steps.filter(s => !s.ok && !s.warnOnly);
return { steps, passed: fatalFails.length === 0 };
```
A step fails the smoke run only if `!ok && !warnOnly`. (Mutation M11 proved no
unit test covered this: dropping `!warnOnly` would turn every flaky URL into a
hard FAIL. Regression test added on this branch.)

## Gotchas
- **Zero unit tests** covered this module before guild-18 (`tests/harness.test.js`
  never imports it). The M11/M12/M13 mutants all survived for this reason.
- **Unbounded script-syntax phase (fuzz F11):** scripts are checked
  *sequentially*, one `node --check` spawn each (~0.3–0.4s). 300 scripts blew
  past a 120s budget. There is no per-phase timeout — `timeoutMs` only bounds
  the walkthrough child. A skill with hundreds of scripts makes `verify` take
  unbounded wall-clock.
- `urlLiveness` worst case: 25 URLs × 2 methods × 8s ≈ 400s sequential. All
  warn-only, but the wall-clock is real.
- Walkthrough stdout >4MB → `maxBuffer` error → graceful single failing step
  (fuzz F12), no crash.
- Walkthrough parsing only recognizes lines starting `PASS`/`FAIL ` — a
  `FAIL`-only script yields zero steps → "no PASS/FAIL lines emitted" fail step
  (equivalent outcome, but the *reason* reported is misleading).
- `execFile` without `shell`: script paths with spaces are safe; the walkthrough
  inherits the harness's env plus `HARNESS_SKILL_DIR`.
