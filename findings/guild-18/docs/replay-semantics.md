# Replay semantics (wave300 branches)

The replay harness lives on the `wave300/replay-*` branch family
(`replay-harness`, `replay-w1-docs-recorder`, `replay-w2-runner`,
`replay-w3-gate`) — **not** on `main`. This doc describes that branch
family's design as of 2026-10-08, from `docs/REPLAY-HARNESS.md`,
`lib/trace.mjs`, `lib/replay.mjs`, `lib/scrub.mjs`, and
`traces/BROKEN-CHANGE-DEMO.md`.

Pipeline: **Discover → Replay → Propose → Promote.**

```
agent change proposed
       │
       ▼
verify --record          (Discover: run live, record a trace)
       │
       ▼
verify --replay <trace>  (Replay: re-run; recorded-pass steps that now fail
                          are regressions; mocked network steps are skipped)
       │
       ▼
promotion gate           (Propose→Promote: regression-free replay required
                          before a badge is regenerated)
```

## Trace format v1 (JSONL, `traces/`)
- **Line 1 — header:** `{"v":1,"type":"header","skill","version","seed","harness","startedAt"}`
  - `seed` = `$HARNESS_SEED` at record time (empty string if unset); replay
    restores it into the environment for deterministic re-execution.
  - `harness` = harness repo commit SHA at record time — the trace is only
    valid against the code that produced it.
- **Lines 2..N+1 — steps:** `{"v":1,"type":"step","seq","phase","name","status","detail","mocked"}`
  - `phase`: `"check"` (all static checks, in `runStaticChecks` order) then
    `"smoke"` (in `runSmoke` order). `seq` is 1-based, no gaps.
  - `status`: `pass`|`fail`|`warn`. Smoke steps map `(ok, warnOnly)` →
    pass / warn / fail.
  - `mocked`: `true` iff the step is a network-liveness probe (name starts
    with `url`, covering `url:` and `url-liveness:`). Every step line carries it.
  - `detail` is **secret-scrubbed** before serialization (below).
- **Last line — footer:** `{"v":1,"type":"footer","status","steps","endedAt"}`.
  `status` is `fail` iff any step failed (`warn` never flips it — same rule
  as the main harness).

## Recorder (`lib/trace.mjs`)
`recordVerifyTrace({ harnessRoot, skill, version, seed, harnessCommit, checks, smoke, outPath })`
serializes a verify run to
`traces/<skill>-<version>-<UTCSTAMP>.trace.jsonl`. Zero dependencies beyond
node:fs/path. Check steps use `check.name ?? check.id`; smoke steps use the
verbatim step name.

## Secret scrubber (`lib/scrub.mjs`)
Every `detail` passes through `scrubSecrets()` → `[REDACTED]`. Patterns:
`sk-` keys, `ghp_|gho_|github_pat_` tokens, `xox[bap]-` Slack tokens,
`AKIA` AWS key IDs, `Bearer <token>`, `api[_-]?key\s*[:=]\s*…`. Pure regex,
zero deps. Lossy on purpose: a trace is evidence, not a debug log.
(Adversarial note: patterns are syntactic — a novel secret format the regexes
don't know will persist verbatim. The scrubber is a backstop, not a guarantee.)

## Replay + gate (`lib/replay.mjs`)
`replayTrace(tracePath, { skillDir, harnessRoot, timeoutMs })`:
1. Parses the trace strictly: every line must be JSON with `v: 1`; first line
   must be a header. Anything else → throw (`"unsupported trace version"` /
   `"invalid trace: line N is not JSON"`). Guild-18 verified: a forged
   non-JSON trace is rejected, not replayed.
2. Restores `HARNESS_SEED` from the header for the duration of the run.
3. Re-executes only the phases the trace recorded; aligns recorded steps to
   fresh steps **by name** (a `Map`, so duplicate names collapse — last wins).
4. Skips recorded steps with `mocked: true` (or name starting `url-liveness`):
   the network is non-deterministic by design.
5. Divergence kinds:
   - `status` (pass↔fail flip) → **fails the gate** (regression).
   - `missing` (recorded step absent on re-run) → **fails the gate**.
   - `output` (same status, different detail) → reported only.
   - `extra` (re-run step with no recorded counterpart) → reported only.

## What the gate proved (BROKEN-CHANGE-DEMO)
A one-word semantic break (`.sort()` removed from a bundled script's
canonicalizer): static checks stayed green (exit 0), the replay gate caught
9 `[status]` regressions (exit 1) and refused to regenerate the badge. The
demo also surfaced and fixed a real harness bug: `runWalkthrough` only parsed
`PASS` lines, so failing walkthrough steps surfaced as `missing` instead of
`status` (fixed: parse `FAIL` lines too).

## Adversarial notes (guild-18, re-verify R8/R9)
- **Trace tampering:** flipping a recorded `pass`→`fail` produces a `status`
  divergence (expected fail, actual pass) → gate fails. Tampering fails closed.
- **Forged traces:** non-JSON / wrong-version traces are rejected at parse.
- **`mocked` abuse surface:** the gate *trusts* the trace's `mocked` flags —
  a forged trace could mark a failing step `mocked: true` to skip it. But the
  recorder (harness-owned) is the only legitimate trace author, and a forged
  trace is already outside the trust model (traces are evidence, not capabilities).
- **Name-alignment:** steps align by exact name; a renamed step yields
  `missing` (gate fails) + `extra` (reported) — fails closed.
- **Seed:** replay restores the recorded seed, but nothing forces skill code
  to *read* `HARNESS_SEED` — determinism is cooperative.
