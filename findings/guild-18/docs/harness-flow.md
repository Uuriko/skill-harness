# Harness flow — end to end

How a skill goes from a directory to a badge. (`main` branch shape; the
wave300 replay branches add record/replay around step 4 — see
`docs/replay-semantics.md`.)

```
skill-dir/  (must contain SKILL.md)
   │
   ▼
bin/harness.mjs verify <skill-dir>
   │
   ├─ 1. skillVersion() ── git short SHA of the skill dir (or "local")
   │
   ├─ 2. runStaticChecks()  [lib/static-checks.mjs]
   │     SKILL.md → frontmatter parse → name/description/body checks →
   │     file-reference resolution → security-pattern scan
   │     verdict: any fail ⇒ skill fails; warns recorded only
   │
   ├─ 3. runSmoke()  [lib/smoke.mjs]
   │     ├─ script-syntax: node --check / bash -n / python -m py_compile
   │     │   per bundled script (sequential, 15s each, NO phase timeout)
   │     ├─ url-liveness: HEAD→GET per URL, 8s/abort, warn-only, max 25
   │     └─ walkthrough: harness-owned smoke-scripts/<name>.smoke.mjs
   │         child process, HARNESS_SKILL_DIR set, default 120s budget
   │     passed ⇔ no non-warnOnly failures
   │
   ├─ 4. writeResult()  [lib/results.mjs]
   │     results/<skill>/<version>.json  (verdict pass ⇔ 0 static fails
   │     and smoke passed-or-absent)
   │
   ├─ 5. rebuildIndex() ── results/index.json (latest per skill by mtime)
   │
   └─ 6. writeBadge() ── badges/<skill>.svg  (green / yellow-green / red)
        + embed markdown printed to stdout
```

## State locations (all static files, no server)
- `results/<skill>/<version>.json` — full check + smoke evidence per run.
- `results/index.json` — latest-per-skill summary (rebuilt on every
  verify/badge/index/list).
- `badges/<skill>.svg` — the public badge.
- (wave300) `traces/<skill>-<version>-<utc>.trace.jsonl` — recorded replay trace.

## Trust boundaries
1. **The harness never executes skill-owned test code.** Walkthroughs live in
   the harness repo (`smoke-scripts/`); a skill cannot ship its own passing test.
2. **Static checks are advisory for semantics.** A syntax-valid behavioral break
   in a bundled script is invisible to them (proven by the wave300
   BROKEN-CHANGE-DEMO: only the replay gate caught it).
3. **URL liveness is warn-only by design.** The open web is not a stable oracle.
4. **Badges are claims, not proofs.** A badge says "this harness, this version,
   this date, said pass". The evidence is the result JSON + (wave300) the trace.
5. **Secrets in SKILL.md** are pattern-scanned (fail/warn), and wave300 trace
   details are secret-scrubbed before persistence.

## Failure modes (from guild-18 verification)
- Unclosed quote in frontmatter → silently accepted as plain scalar, parse
  reports PASS (real bug, `findings/guild-18/bugs.md`).
- 300 bundled scripts → script-syntax phase exceeds 120s (no phase timeout).
- Corrupt result JSON → skipped by index rebuild (safe).
- Concurrent badge writes → safe (last writer wins, always valid SVG).
- `verify`/`check` exit codes → untested pre-guild-18 (regression tests added).
