# Replay Report — 20 recorded traces, bit-for-bit replay proof

Worker 3, WAVE-300 replay harness. Recorded 2026-10-08 ~20:08–20:13 UTC
(`HARNESS_SEED=1..10` per skill), harness at `b49235c`.

Replay command per trace:

```
node bin/harness.mjs replay <trace> --skill <same-skill-dir>
```

Result: **20/20 replayed CLEAN at status level** (zero `kind:"status"`,
zero `kind:"missing"` divergences). Every replay exited 0.

## Bit-for-bit detail

**20/20 also matched at detail level** — every replay printed
`replay: CLEAN — no divergences`, i.e. zero `kind:"output"` (detail-drift)
divergences too. No detail strings differ between record and replay for any
step in any trace. Mocked `url-liveness` steps (2 per claim-a-task trace,
3 per join-project-room trace) are skipped by design and excluded from the
comparison counts below.

## Per-trace results

### claim-a-task (10 traces, seeds 1–10)

| trace file | steps compared | mocked | clean |
|---|---|---|---|
| claim-a-task-3f68f03-20261008T200840Z.trace.jsonl (seed 1) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T200921Z.trace.jsonl (seed 2) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T200929Z.trace.jsonl (seed 3) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T200935Z.trace.jsonl (seed 4) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T200940Z.trace.jsonl (seed 5) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T200946Z.trace.jsonl (seed 6) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T200956Z.trace.jsonl (seed 7) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T201004Z.trace.jsonl (seed 8) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T201015Z.trace.jsonl (seed 9) | 15 | 2 | yes |
| claim-a-task-3f68f03-20261008T201025Z.trace.jsonl (seed 10) | 15 | 2 | yes |

### join-project-room (10 traces, seeds 1–10)

| trace file | steps compared | mocked | clean |
|---|---|---|---|
| join-project-room-3f68f03-20261008T200909Z.trace.jsonl (seed 1) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201052Z.trace.jsonl (seed 2) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201111Z.trace.jsonl (seed 3) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201126Z.trace.jsonl (seed 4) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201146Z.trace.jsonl (seed 5) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201205Z.trace.jsonl (seed 6) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201218Z.trace.jsonl (seed 7) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201237Z.trace.jsonl (seed 8) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201253Z.trace.jsonl (seed 9) | 29 | 3 | yes |
| join-project-room-3f68f03-20261008T201310Z.trace.jsonl (seed 10) | 29 | 3 | yes |

## kind:"output" notes

None. No detail-drift warnings appeared in any of the 20 replays.

## Provenance note

One pre-existing trace from a sibling worker lives in this directory
(`claim-a-task-3f68f03-20261008T200040Z.trace.jsonl`); it was NOT recorded by
this worker and is excluded from the counts above.

## Code caveat

A harness bug found during the broken-change demo (walkthrough `FAIL` lines
emitted to stderr were invisible to the replay parser; fixed in
`lib/smoke.mjs`, see traces/BROKEN-CHANGE-DEMO.md) landed while these replays
were being collected. Passing runs emit no `FAIL` lines, so both parser
versions produce identical step sets for passing runs — confirmed by
re-running one join-project-room replay after the fix (exit 0, CLEAN).
