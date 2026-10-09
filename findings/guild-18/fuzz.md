# guild-18 fuzz testing — skill-harness

- date: 2026-10-08 (run by wave1000 guild-18, background unit batch 2)
- method: 15 hostile inputs, each with a hard timeout; CLI units ran against scratch copy .tmp/fuzzrepo (real results/ + badges/ untouched)
- inputs run: 15, clean: 12, findings: 3

| id | input | result | detail |
|---|---|---|---|
| F1 | SKILL.md with no frontmatter -> check exits 1, clean error | **PASS** | exit=1 cleanErr=true out=== static checks: f1@f3606d3 ==
  [✓] skill-md-exists: SKILL.md present.
  [✗] f |
| F2 | unclosed quote in frontmatter -> parse fail, no hang | **FAIL** | exit=0 |
| F3 | 8MB SKILL.md -> completes < 60s | **PASS** | exit=0 timedOut=false |
| F4 | 2000-deep nested frontmatter -> no stack overflow | **PASS** | exit=0 noStackOverflow=true |
| F5 | corrupt + 50MB result files -> index rebuild skips, no crash | **PASS** | exit=0 indexWritten=true |
| F6 | directory named like a result file -> skipped, no EISDIR crash | **PASS** | exit=0 err= |
| F7 | 10 concurrent badge writes -> all succeed, valid SVG | **PASS** | allExit0=true validSvg=true |
| F8 | badge name with ../ traversal -> contained in badges/? | **PASS** | exit=1 contained=true |
| F9 | BOM-prefixed SKILL.md -> clean fail, no crash | **PASS** | exit=1 |
| F10 | 1MB single-line frontmatter value -> completes | **PASS** | exit=1 timedOut=false |
| F11 | skill with 300 scripts -> bounded, completes | **FAIL** | exit=null scriptSteps~0 |
| F12 | walkthrough flooding stdout -> graceful fail step, no crash | **PASS** | exit=0 graceful=true |
| F13 | SKILL.md as dangling symlink -> exit 1, no stack | **PASS** | exit=1 |
| F14 | replay gate: mutated skill after recording must be rejected | **FAIL** | driver exception: Command failed: git -C /home/hatch/workspace/pr-wave1000-guild-18 worktree add /home/hatch/workspace/pr-wave1000-guild-18/.tmp/fuzzrepo-rv origin/wave300/replay-harness
fatal: invalid reference: origi |
| F15 | duplicate keys + non-string metadata -> clean warn/fail, no crash | **PASS** | exit=1 |

## Findings (with repro)

### F2: unclosed quote in frontmatter → parse fail, no hang — REAL BUG (fail-open)
- detail: `check` on a skill whose frontmatter has an unterminated quote
  (`description: "never closed`) exits **0** — the value is silently accepted
  as a plain scalar *including the quote character*, and `frontmatter-parse`
  reports PASS. Strict YAML would reject it; the harness's "Frontmatter
  parses." signal is false. Full report: `findings/guild-18/bugs.md`.
  Repro:
  ```
  mkdir -p /tmp/f2skill && printf -- '---\nname: f2\ndescription: "never closed\n---\n\n# T\n' > /tmp/f2skill/SKILL.md
  node bin/harness.mjs check /tmp/f2skill   # exits 0, should exit 1
  ```

### F11: skill with 300 scripts → bounded, completes — PERF GAP (no phase timeout)
- detail: `smoke` on a skill with 300 bundled scripts did not complete within
  the 120s unit budget (exit=null, timed out). `checkScript` spawns one
  `node --check` per script *sequentially* (~0.3–0.4s each); `timeoutMs` only
  bounds the walkthrough child, so the script-syntax phase has no time bound
  at all. A skill with hundreds of scripts makes `verify` take unbounded
  wall-clock. No wrong verdict — robustness/perf only. Repro: generate
  `scripts/s<i>.mjs` × 300 in a fixture skill, `time node bin/harness.mjs
  smoke <skill>`.

### F14: replay gate — DRIVER ERROR (not a harness finding)
- detail: the fuzz driver ran `git fetch origin wave300/replay-harness`
  (bare branch name), which updates FETCH_HEAD but not the remote-tracking
  ref, so `git worktree add … origin/wave300/replay-harness` failed with
  "invalid reference". The replay-gate adversarial test was re-run properly
  in the RE-VERIFY track (R8): tampered trace → gate fails closed, badge not
  regenerated; forged non-JSON trace → rejected at parse. No bypass found.

## Notes (corrected post-analysis)
- F8 traversal: **PASS — not vulnerable.** `badge <name>` joins
  `badges/<name>.svg` with no sanitization, but the write is unreachable with
  a traversal: unknown names exit 1 *before* any write (index lookup miss),
  and `verify`-flow names pass through `basename()`. The probe
  `badge ../../.tmp/g18traversal-probe` exited 1 with no file written outside
  `badges/`. A standalone negative-repro is kept at
  `findings/guild-18/repro-traversal.mjs` documenting why it is safe.
- F2 is the single real correctness bug found by fuzzing (fail-open parse).
- F10's exit=1 is correct behavior (1MB description exceeds the 1024-char spec
  limit → description-length fails).
- F1's version string (`f1@f3606d3`) shows `skillVersion` following git upward
  into the enclosing repo — documented in `docs/gotchas.md`.
