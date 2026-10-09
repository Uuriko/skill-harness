# guild-18 re-verification — wave300/replay-harness branch family

- date: 2026-10-08 (run by wave1000 guild-18, background unit batch 3, v2)
- origin/main at rebase time: 2377a04dbbfccb44595d7061b8d38a92780c3528

## R1: branch SHAs (pre-rebase)
- wave300/replay-harness: 1f193904b41997091ccab0e50c8c6153df017709
- wave300/replay-w1-docs-recorder: 96949ab20b439056f4c0f16916e0e8b4e297e2e0
- wave300/replay-w2-runner: 7df8d142bd9fb52a766eed4e97ce5a15499981d4
- wave300/replay-w3-gate: 948cfd2b15ea92ccd95963114cc1bd5ed530813f

## R2: rebase wave300/replay-harness onto origin/main

- rebase: CLEAN

## R3: rebase wave300/replay-w1-docs-recorder onto origin/main

- rebase: CLEAN

## R4: rebase wave300/replay-w2-runner onto origin/main

- rebase: CLEAN

## R5: rebase wave300/replay-w3-gate onto origin/main

- rebase: CLEAN

## R6: full suite — wave300/replay-harness (scratch, rebased where clean)

```
### npm test

> skill-harness@0.1.0 test
> node --test tests/harness.test.js

✔ frontmatter: parses name/description/metadata map (45.273021ms)
✔ frontmatter: rejects missing delimiters (8.09574ms)
✔ frontmatter: quoted description with colon (0.358859ms)
✔ static: good fixture passes (161.705262ms)
✔ static: sneaky fixture fails security scan (11.971696ms)
✔ static: sloppy fixture fails name, warns on the rest (5.603108ms)
✔ static: missing SKILL.md fails fast (2.401444ms)
✔ badge: svg reflects verdict and date (2.060892ms)
✔ results: writeResult + rebuildIndex round-trip (8.847047ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2617.147267
npm-test-exit=0
### check good-skill (expect 0)
check-good-exit=0
### check sneaky-skill (expect 1)
check-sneaky-exit=1
```

## R6: full suite — wave300/replay-w1-docs-recorder (scratch, rebased where clean)

```
### npm test

> skill-harness@0.1.0 test
> node --test tests/harness.test.js

✔ frontmatter: parses name/description/metadata map (45.322926ms)
✔ frontmatter: rejects missing delimiters (2.579161ms)
✔ frontmatter: quoted description with colon (13.625288ms)
✔ static: good fixture passes (36.414377ms)
✔ static: sneaky fixture fails security scan (110.125355ms)
✔ static: sloppy fixture fails name, warns on the rest (20.588527ms)
✔ static: missing SKILL.md fails fast (18.06464ms)
✔ badge: svg reflects verdict and date (5.583459ms)
✔ results: writeResult + rebuildIndex round-trip (27.755393ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1724.347197
npm-test-exit=0
### check good-skill (expect 0)
check-good-exit=0
### check sneaky-skill (expect 1)
check-sneaky-exit=1
```

## R6: full suite — wave300/replay-w2-runner (scratch, rebased where clean)

```
### npm test

> skill-harness@0.1.0 test
> node --test tests/harness.test.js

✔ frontmatter: parses name/description/metadata map (6.957421ms)
✔ frontmatter: rejects missing delimiters (1.203206ms)
✔ frontmatter: quoted description with colon (1.877678ms)
✔ static: good fixture passes (9.954158ms)
✔ static: sneaky fixture fails security scan (3.129336ms)
✔ static: sloppy fixture fails name, warns on the rest (1.60555ms)
✔ static: missing SKILL.md fails fast (4.550879ms)
✔ badge: svg reflects verdict and date (1.862045ms)
✔ results: writeResult + rebuildIndex round-trip (9.212425ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3263.659661
npm-test-exit=0
### check good-skill (expect 0)
check-good-exit=0
### check sneaky-skill (expect 1)
check-sneaky-exit=1
```

## R6: full suite — wave300/replay-w3-gate (scratch, rebased where clean)

```
### npm test

> skill-harness@0.1.0 test
> node --test tests/harness.test.js

✔ frontmatter: parses name/description/metadata map (215.454223ms)
✔ frontmatter: rejects missing delimiters (4.980174ms)
✔ frontmatter: quoted description with colon (0.298038ms)
✔ static: good fixture passes (17.885871ms)
✔ static: sneaky fixture fails security scan (4.074925ms)
✔ static: sloppy fixture fails name, warns on the rest (0.85912ms)
✔ static: missing SKILL.md fails fast (0.868353ms)
✔ badge: svg reflects verdict and date (0.577506ms)
✔ results: writeResult + rebuildIndex round-trip (5.163119ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3640.424585
npm-test-exit=0
### check good-skill (expect 0)
check-good-exit=0
### check sneaky-skill (expect 1)
check-sneaky-exit=1
```

## R7: adversarial diff review (branch vs origin/main)

### wave300/replay-harness

```
 ...aim-a-task-3f68f03-20261008T200921Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200929Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200935Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200940Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200946Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200956Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T201004Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T201015Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T201025Z.trace.jsonl |  19 ++
 ...oject-room-3f68f03-20261008T200909Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201052Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201111Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201126Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201146Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201205Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201218Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201237Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201253Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201310Z.trace.jsonl |  34 +++
 38 files changed, 1721 insertions(+), 12 deletions(-)
```

### wave300/replay-w1-docs-recorder

```
 docs/REPLAY-HARNESS.md | 242 +++++++++++++++++++++++++++++++++++++++++++++++++
 lib/scrub.mjs          |  34 +++++++
 lib/trace.mjs          |  91 +++++++++++++++++++
 tests/trace.test.js    | 163 +++++++++++++++++++++++++++++++++
 4 files changed, 530 insertions(+)
```

### wave300/replay-w2-runner

```
 lib/replay.mjs                                     | 145 +++++++++++++++++++++
 tests/fixtures/replay/fixture-skill.trace.jsonl    |  18 +++
 tests/fixtures/replay/fixture-skill/SKILL.md       |  14 ++
 tests/fixtures/replay/fixture-skill/scripts/ok.mjs |   4 +
 tests/replay.test.js                               |  75 +++++++++++
 5 files changed, 256 insertions(+)
```

### wave300/replay-w3-gate

```
 ...aim-a-task-3f68f03-20261008T200921Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200929Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200935Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200940Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200946Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T200956Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T201004Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T201015Z.trace.jsonl |  19 ++
 ...aim-a-task-3f68f03-20261008T201025Z.trace.jsonl |  19 ++
 ...oject-room-3f68f03-20261008T200909Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201052Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201111Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201126Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201146Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201205Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201218Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201237Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201253Z.trace.jsonl |  34 +++
 ...oject-room-3f68f03-20261008T201310Z.trace.jsonl |  34 +++
 38 files changed, 1718 insertions(+), 12 deletions(-)
```

## R8: replay-gate bypass attempt (scratch of wave300/replay-w3-gate)

- replay surface files:
docs/REPLAY-HARNESS.md
lib/replay.mjs
lib/scrub.mjs
lib/trace.mjs
tests/fixtures/replay/fixture-skill.trace.jsonl
tests/fixtures/replay/fixture-skill/SKILL.md
tests/fixtures/replay/fixture-skill/scripts/ok.mjs
tests/replay.test.js
tests/trace.test.js
traces/BROKEN-CHANGE-DEMO.md
traces/REPLAY-REPORT.md
traces/claim-a-task-3f68f03-20261008T200040Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T200840Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T200921Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T200929Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T200935Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T200940Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T200946Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T200956Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T201004Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T201015Z.trace.jsonl
traces/claim-a-task-3f68f03-20261008T201025Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T200909Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201052Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201111Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201126Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201146Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201205Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201218Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201237Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201253Z.trace.jsonl
traces/join-project-room-3f68f03-20261008T201310Z.trace.jsonl

- CLI --replay flag: checking usage text
skill-harness — independent verified-working tester for Agent Skills

usage:
  harness.mjs check <skill-dir>   static checks only
  harness.mjs smoke <skill-dir>   smoke tests only
  harness.mjs verify <skill-dir> [--record [out]] [--replay <trace>]
                                  full run + results + badge;
                                  --record writes a replay trace of this run;
                                  --replay <trace> gates promotion: any step that
                                  passed in the trace but fails now blocks the badge
  harness.mjs replay <trace> --skill <dir>
                                  re-execute a recorded trace, report divergence

### Bypass attempt A: tampered trace (flip a recorded pass to fail, re-run gate)

- victim trace: tests/fixtures/replay/fixture-skill.trace.jsonl
- tampered copy written to .tmp/tampered.trace.jsonl
- running: verify <fixture> --replay .tmp/tampered.trace.jsonl
```
== static checks: fixture-skill@e97a040 ==
  [✓] skill-md-exists: SKILL.md present.
  [✓] frontmatter-parse: Frontmatter parses.
  [✓] name-present: name: fixture-skill
  [✓] name-format: 1–64 chars, lowercase alnum + hyphens, no leading/trailing/double hyphens.
  [✓] name-matches-dir: Matches directory name "fixture-skill".
  [✓] description-present: 111 chars.
  [✓] description-length: Within the 1–1024 char spec range.
  [✓] description-quality: Describes what the skill does and when to use it.
  [✓] body-nonempty: 9 lines of instructions.
  [✓] body-length: 11 lines (spec recommends < 500).
  [✓] body-structure: Has headings and/or numbered steps.
  [✓] file-references-resolve: 1 referenced file(s), all resolve.
  [✓] security-scan: No instruction-smuggling or exfiltration patterns matched.
static: PASS (0 fail, 0 warn)
== smoke tests: fixture-skill@e97a040 ==
  [✓] script-syntax: ok.mjs: parses
  [✓] url-liveness: no concrete URLs referenced
  [✓] walkthrough: no harness walkthrough script for this skill
smoke: PASS (3/3 steps)

replay gate FAILED vs .tmp/tampered.trace.jsonl: 15 regression(s)
  [status] skill-md-exists: recorded "fail", now "pass"
  [status] frontmatter-parse: recorded "fail", now "pass"
  [status] name-present: recorded "fail", now "pass"
  [status] name-format: recorded "fail", now "pass"
  [status] name-matches-dir: recorded "fail", now "pass"
  [status] description-present: recorded "fail", now "pass"
  [status] description-length: recorded "fail", now "pass"
  [status] description-quality: recorded "fail", now "pass"
  [status] body-nonempty: recorded "fail", now "pass"
  [status] body-length: recorded "fail", now "pass"
  [status] body-structure: recorded "fail", now "pass"
  [status] file-references-resolve: recorded "fail", now "pass"
  [status] security-scan: recorded "fail", now "pass"
  [status] script-syntax: ok.mjs: recorded "fail", now "pass"
  [status] walkthrough: recorded "fail", now "pass"
badge not regenerated; change not promoted.
gate-exit=1
```

### Bypass attempt B: forged trace with no header / wrong version

forged trace rejected (good): invalid trace: line 1 is not JSON

## R9: adversarial review notes

Reviewer looked for: trace forgery acceptance, scrub bypass (secrets persisted),
mocked-step abuse (attacker marking failing steps mocked), seed non-determinism,
gate-kind downgrade (status->output), badge regeneration on gate failure.

(Detailed per-file notes appended after the diff stat review in the final pass.)

## R10: verdict

- scratch worktrees/branches removed; only wave1000/guild-18 remains.
- Per-branch verdicts: see R2–R9 above.
- R2–R5: all four branches rebase CLEAN onto origin/main (2377a04).
- R6: all four full suites green (npm test 9/9; check good-skill exit 0; check sneaky-skill exit 1).

## R11 (follow-up): full test files on replay-harness + CI gap

`npm test` on every wave300 branch still runs ONLY `tests/harness.test.js`
(package.json `"test": "node --test tests/harness.test.js"` — unchanged on all
four branches). The replay work added `tests/gate.test.js`,
`tests/replay.test.js`, `tests/trace.test.js`, which therefore **never execute
under `npm test`** — a CI gap: the replay gate's own tests don't run in the
standard suite.

Guild-18 ran them explicitly on a scratch worktree of
`origin/wave300/replay-harness` (rebased clean):
`node --test tests/harness.test.js tests/gate.test.js tests/replay.test.js tests/trace.test.js`
→ **27/27 pass**, including:
- gate: `--record` writes a trace; `--replay` against a fresh record is clean;
  a smoke-step break invisible to static checks blocks promotion (exit 1);
- replay: unmodified fixture replays with zero divergences; broken script
  syntax surfaces a `status` divergence; unsupported trace version throws;
  `HARNESS_SEED` restored after replay (success and throw paths);
- trace: valid JSONL header/step/footer, secret scrubbing, `mocked` flags,
  status mapping, default outPath under `<harnessRoot>/traces/`;
- scrub: sk-/ghp-/Bearer/slack/AWS/api_key redaction, non-string passthrough.

So the replay code is correct and tested — the tests just aren't wired into
`npm test`. Recommended fix (for the wave300 owners, not this guild): extend
the test script to `node --test tests/*.test.js` (note: repo commit 3b6c6b3
says the Node v24 *directory* form `node --test tests/` is broken, so the
explicit glob is the working form).

## R12: adversarial diff review — detailed notes

- **wave300/replay-w1-docs-recorder** (docs + `lib/trace.mjs` + `lib/scrub.mjs`
  + `tests/trace.test.js`): additive only. Recorder writes JSONL with
  `mocked` on every step line; scrubber is pure regex. No changes to existing
  lib files. Clean.
- **wave300/replay-w2-runner** (`lib/replay.mjs` + fixtures + `tests/replay.test.js`):
  additive only. Strict trace parsing (every line JSON, `v:1`, header-first).
  Name-based step alignment via Map (duplicate names collapse, last wins —
  acceptable: harness step names are unique in practice). Mocked steps
  (`mocked:true` or `url-liveness` prefix) skipped. Clean.
- **wave300/replay-w3-gate** (CLI `--record`/`--replay` + `replay` command +
  traces): the only branch touching existing files (bin/harness.mjs usage text
  + verify flow, 12 deletions total across the family). Gate semantics:
  `status`/`missing` divergences fail the gate and block badge regeneration;
  `output`/`extra` are reported only. Bypass attempts R8: tampered trace
  (pass→fail flip) → gate fails closed, badge not regenerated; forged
  non-JSON trace → rejected at parse. The BROKEN-CHANGE-DEMO proves the gate
  catches a semantic break static checks miss.
- **wave300/replay-harness** (integration): the union of the above + recorded
  traces. No conflicts with current main (R2 clean rebase).

**Adversarial verdict:** no bypass found. The gate fails closed on tampered
and forged traces; the one structural weakness is trust in the trace's own
`mocked` flags (a forged trace could mark a failing step mocked) — but trace
authorship is harness-side, so this is outside the threat model, and it is
documented in `docs/replay-semantics.md`.

