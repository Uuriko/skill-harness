# Broken-Change Acceptance Demo

Proves the replay gate catches a behavioral break that static checks cannot
see. Recorded 2026-10-08 on branch `wave300/replay-w3-gate` (harness
`b49235c` + the `lib/smoke.mjs` stderr-parse fix described below).

All work happened on a **copy** at `$TMPDIR/join-project-room`
(`~/workspace/pr-wave300-replay-w3/.tmp/join-project-room`).
`~/workspace/agent-skills` was never modified (verified: no diff).
Note: the copy keeps the leaf dir name `join-project-room` so the
`name-matches-dir` static check stays green — the point of the demo is a
break static checks miss, not a renamed directory.

## Step 1 — record a good trace (exit 0)

```
$ HARNESS_SEED=7 node bin/harness.mjs verify $TMPDIR/join-project-room --record $TMPDIR/good.trace.jsonl
  [✓] walkthrough: 3/4: skill sign-card.mjs produces a server-verifiable signature
  ...
trace recorded: /home/hatch/workspace/pr-wave300-replay-w3/.tmp/good.trace.jsonl
verdict: PASS
```

Exit code: **0**. The good trace records all steps `pass`, including
`walkthrough: 3/4`.

## Step 2 — introduce the break (invisible to static checks)

```
$ sed -i 's/for (const key of Object.keys(value).sort()) {/for (const key of Object.keys(value)) {/' \
    $TMPDIR/join-project-room/scripts/sign-card.mjs
```

This removes `.sort()` from the `canonicalize` function in
`scripts/sign-card.mjs` (line 42). JSON keys are no longer sorted before
signing, so the produced Ed25519 signature no longer matches what the room's
`verifyCardSignature` expects. Syntax stays valid:

```
$ node --check $TMPDIR/join-project-room/scripts/sign-card.mjs
node --check: OK
```

## Step 3 — static checks miss it (exit 0)

```
$ node bin/harness.mjs check $TMPDIR/join-project-room
== static checks: join-project-room@b49235c ==
  [✓] skill-md-exists: SKILL.md present.
  [✓] frontmatter-parse: Frontmatter parses.
  [✓] name-present: name: join-project-room
  [✓] name-format: 1–64 chars, lowercase alnum + hyphens, no leading/trailing/double hyphens.
  [✓] name-matches-dir: Matches directory name "join-project-room".
  [✓] description-present: 394 chars.
  [✓] description-length: Within the 1–1024 char spec range.
  [✓] description-quality: Describes what the skill does and when to use it.
  [✓] body-nonempty: 169 lines of instructions.
  [✓] body-length: 171 lines (spec recommends < 500).
  [✓] body-structure: Has headings and/or numbered steps.
  [✓] file-references-resolve: 0 referenced file(s), all resolve.
  [✓] security-scan: No instruction-smuggling or exfiltration patterns matched.
static: PASS (0 fail, 0 warn)
```

Exit code: **0** — static checks are green on the broken copy. This is what
the demo proves about static analysis: a syntax-valid semantic break in a
bundled script is invisible to it.

## Step 4 — the replay gate catches it (exit 1)

```
$ node bin/harness.mjs verify $TMPDIR/join-project-room --replay $TMPDIR/good.trace.jsonl
== static checks: join-project-room@b49235c ==
  ... (all static checks pass, as above)
== smoke tests: join-project-room@b49235c ==
  [✓] script-syntax: sign-card.mjs: parses
  [✓] url-liveness: https://github.com/Uuriko/project-room: HEAD 200
  [✓] url-liveness: https://room.trydemigod.com: HEAD 200
  [✓] url-liveness: https://github.com/Uuriko/project-room/issues/266: HEAD 200
  [✓] walkthrough: 1a: agent-card.json served
  [✓] walkthrough: 1b: llms.txt served
  [✓] walkthrough: 1c: public guest-invite contract
  [✓] walkthrough: 2: identity-create returns ai_ id + pri_ secret
  [✓] walkthrough: owner mint issues GX- code
  [✓] walkthrough: 5d: tampered card → 422 card_invalid
smoke: PASS (10/10 steps)

replay gate FAILED vs /home/hatch/workspace/pr-wave300-replay-w3/.tmp/good.trace.jsonl: 9 regression(s)
  [status] walkthrough: 3/4: recorded "pass", now "fail"
  [status] walkthrough: 5: recorded "pass", now "fail"
  [status] walkthrough: 5b: recorded "pass", now "fail"
  [status] walkthrough: 5c: recorded "pass", now "fail"
  [status] walkthrough: 6a: recorded "pass", now "fail"
  [status] walkthrough: 6b: recorded "pass", now "fail"
  [status] walkthrough: 6c: recorded "pass", now "fail"
  [status] walkthrough: 6d: recorded "pass", now "fail"
  [status] walkthrough: 6e: recorded "pass", now "fail"
badge not regenerated; change not promoted.
```

Exit code: **1**.

What this proves, line by line:

- The gate's first and root-cause regression is
  `[status] walkthrough: 3/4: recorded "pass", now "fail"` — exactly the step
  that exercises the broken `sign-card.mjs` (`"skill sign-card.mjs produces a
  server-verifiable signature"`).
- The 8 follow-on `[status]` regressions (5, 5b, 5c, 6a–6e) are cascade
  failures: they depend on the signed card from step 3/4, which no longer
  verifies. The root cause is 3/4.
- `badge not regenerated` and badge file mtime unchanged
  (`badges/join-project-room.svg` identical before/after) — the broken change
  is **not promoted**.

## Harness bug found and fixed during this demo

The first gate run reported the 9 regressions as `kind:"missing"` instead of
`kind:"status"`: the failing walkthrough step never appeared as a fresh
`fail` step. Root cause: `runWalkthrough` in `lib/smoke.mjs` parsed only
**stdout** for `PASS|FAIL` lines, but the walkthrough script emits `FAIL`
lines via `console.error` (stderr) — see
`smoke-scripts/join-project-room.smoke.mjs:39`. A failing step therefore
vanished from the fresh run instead of surfacing as a status regression.

Fix (in this branch, `lib/smoke.mjs`): scan `stdout` **and** `stderr` for
`PASS|FAIL` step lines. After the fix, the demo above produces
`kind:"status"` regressions as specified. Passing runs emit no `FAIL` lines,
so the fix does not alter any passing-run behavior (verified: one recorded
join-project-room trace replayed after the fix → exit 0, CLEAN, zero
divergences).

`~/workspace/agent-skills` was not modified at any point (copy-only rule
held; `git diff` on the source tree is empty).
