# Replay Harness

Stolen from Hone's "Closing The Gap #1": every agent-authored change replays in
simulation before it is promoted. Hone measured regressions dropping 33% → 5%
when changes had to re-earn their green inside a replayed simulation instead of
a fresh live run.

Pipeline: **Discover → Replay → Propose → Promote**.

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

This document is the authoritative spec for the three pieces this lane owns:
the **trace format**, the **trace recorder** (`lib/trace.mjs`), and the
**secret scrubber** (`lib/scrub.mjs`). The CLI flags (`--record`, `--replay`)
and the replay runner itself are the coordinator's partition — this lane does
not wire any commands.

## 1. Problem statement

Today `skill-harness verify` runs static checks and smoke tests live against a
skill and emits a pass/fail badge. A passing run proves the skill was green at
that instant, in that environment, against that version of the open web. It
does not prove:

- that a *change* to the skill caused no regression (the old result is not
  preserved anywhere, so there is nothing to diff against),
- that the result was reproducible (URL-liveness probes hit the live internet;
  walkthroughs may depend on wall-clock, randomness, or external state),
- that the evidence is safe to keep (step details can echo tokens, keys, or
  URLs with embedded credentials — persisting those verbatim in
  `traces/` would leak secrets into the repo).

A promotion-gate needs durable, replayable evidence: a recorded run, a
replayed run, and a clear rule for what counts as a regression.

## 2. The stolen mechanism

From Hone: **record / mock / fast-forward / gate**.

| Mechanism    | Replay-harness shape |
| ------------ | -------------------- |
| **record**   | `verify --record` executes the full verify pipeline (static checks + smoke) and writes a JSONL **trace**: header, one line per step, footer. Every step carries its phase, name, status, and a secret-scrubbed detail. |
| **mock**     | Network-touching steps are identified at record time (names starting with `url`; see §5) and marked `mocked: true`. On replay they are skipped — they are warn-only by design and the open web is not a stable simulation. |
| **fast-forward** | Replay re-runs phases wholesale and aligns recorded steps to fresh steps **by name** (§6). Cheap deterministic phases (static checks, script-syntax) always re-execute; expensive/networked phases are skipped where mocked. |
| **gate**     | `verify --replay <trace>`: any step that recorded `pass` and now evaluates `fail` is a **regression** and blocks promotion (badge regeneration). Output-only divergences (same status, different detail) are **warnings**, not regressions (§7). |

## 3. Trace format v1

The trace is JSONL — one JSON object per line, UTF-8. No indentation, no
streaming delimiters; every line must parse independently (`JSON.parse` per
line). The `v` field is the format version and must be `1`.

### 3.1 Header (line 1)

```json
{"v":1,"type":"header","skill":"<skill name>","version":"<skill version>",
 "seed":"<HARNESS_SEED value>","harness":"<harness commit SHA>",
 "startedAt":"<ISO-8601 timestamp>"}
```

- `seed`: the value of the `HARNESS_SEED` environment variable at record time
  (empty string if unset). Recorded so replay can restore determinism (§8).
- `harness`: the harness repo's git commit SHA at record time — the trace is
  only valid against the code that produced it.
- `startedAt`: ISO-8601 UTC timestamp of record start.

### 3.2 Step lines (lines 2..N+1)

```json
{"v":1,"type":"step","seq":1,"phase":"check","name":"skill-md-exists",
 "status":"pass","detail":"SKILL.md present.","mocked":false}
```

Fields:

| Field    | Meaning |
| -------- | ------- |
| `v`      | format version, always `1` |
| `type`   | `"step"` |
| `seq`    | 1-based sequence number; lines run `1..N` with no gaps |
| `phase`  | `"check"` (static checks) or `"smoke"` (smoke tests) |
| `name`   | step name. For checks: the check's `name` field, falling back to its `id` (current `lib/static-checks.mjs` emits `id`). For smoke: the smoke step's `name` verbatim |
| `status` | `"pass"` \| `"fail"` \| `"warn"`. Check steps copy the check's `status`. Smoke steps map from `(ok, warnOnly)` per §5 |
| `detail` | human-readable detail, **secret-scrubbed** (§4) |
| `mocked` | `true` iff the step is a network-liveness step (name starts with `url`, e.g. `url:` or `url-liveness:`); otherwise `false`. Included on every step line |

Step order: all `phase: "check"` steps first (in `runStaticChecks` order),
then all `phase: "smoke"` steps (in `runSmoke` order). `seq` numbers them in
this order.

### 3.3 Footer (last line)

```json
{"v":1,"type":"footer","status":"pass","steps":12,"endedAt":"<ISO-8601>"}
```

- `status`: `"fail"` if any step line has `status: "fail"`, else `"pass"`.
  (`"warn"` never flips the verdict, matching the existing harness rule:
  any fail ⇒ skill fails; warn-only is recorded, never fatal.)
- `steps`: total number of step lines.
- `endedAt`: ISO-8601 UTC timestamp of record end.

## 4. Secret-scrub rules (`lib/scrub.mjs`)

Every `detail` written to a trace passes through `scrubSecrets(text)` before
it is serialized. Patterns replaced with `[REDACTED]`:

| Pattern | Example it catches |
| ------- | ------------------ |
| `sk-[A-Za-z0-9_-]{20,}` | OpenAI-style secret keys (`sk-…`) |
| `ghp_`/`gho_`/`github_pat_` + 20+ alnum chars | GitHub personal/OAuth tokens |
| `xox[bap]-` + non-whitespace | Slack tokens |
| `AKIA[0-9A-Z]{16}` | AWS access key IDs |
| `Bearer\s+\S+` | Bearer auth headers in HTTP detail text |
| `api[_-]?key\s*[:=]\s*['"]?\S+` | `api_key=…`, `apikey: …`, `api-key="…"` |

`scrubSecrets` is exported alongside `SCRUB_PATTERNS` (the list of regexes,
in case another lane needs to audit or extend them). Non-string input is
returned as-is (no coercion — a `null` detail stays `null`, a number stays a
number; the recorder only scrubs strings).

Scrubbing is **lossy on purpose**: the trace is evidence, not a debug log.
Anything that looked like a credential is gone from the recorded detail.

## 5. Record semantics (`verify --record`)

Recording is a faithful wrapper around the existing verify pipeline; it does
not alter what runs.

1. Capture `startedAt`, `skill`, `version`, `seed` (from `HARNESS_SEED` env,
   empty string if unset), and `harness` (current commit SHA).
2. Run static checks → one step line per check: `phase: "check"`,
   `name` = check's `name` falling back to `id` (see note below), `status` =
   check's `status` verbatim, `detail` = scrubbed check detail.
3. Run smoke → one step line per smoke step: `phase: "smoke"`, `name` =
   smoke step name verbatim, status mapped as:

   | `ok` | `warnOnly` | recorded `status` |
   | ---- | ---------- | ------------------ |
   | true | either     | `"pass"` |
   | false | true      | `"warn"` |
   | false | false     | `"fail"` |

   `mocked` = `true` iff the name starts with `url` (covers `url:` and the
   current `url-liveness:` prefix; anything network-probed by name is mocked).
4. Write the footer, return the trace path.

Default trace path: `<harnessRoot>/traces/<skill>-<version>-<UTC-timestamp>.trace.jsonl`,
creating `traces/` if missing. Timestamp format: `YYYYMMDDTHHMMSSZ`.

Record-time note: the current `lib/static-checks.mjs` emits check objects with
an **`id`** field (the brief's `name` field does not exist in the code as of
this writing). The recorder reads `name ?? id` so traces stay valid if the
checks are ever renamed.

## 6. Replay semantics (coordinator's runner — contract)

Replay is specified here so record and replay agree; the runner itself is the
coordinator's partition.

1. Load the trace. Reject traces with `v !== 1` (unknown version) rather than
   guessing.
2. Restore determinism: set `HARNESS_SEED` to the header's `seed` before
   running anything, and pass it into walkthroughs via env (§8).
3. **Mocked steps are skipped** — any recorded step with `mocked: true` is not
   re-executed; it does not participate in the regression verdict.
4. **Re-run phases wholesale**: static checks run to completion, then smoke
   runs to completion (minus mocked steps). Replay is not step-by-step
   short-circuiting — the full picture is needed for the report.
5. **Align steps by name**: each recorded non-mocked step is paired with the
   fresh step of the same `name` (within the same phase). A fresh run that is
   missing a recorded step name is a **regression** (blocking) — silent loss of
   coverage is exactly what the gate exists to catch; re-record the trace to
   bless a legitimate rename. A brand-new step name is reported as a
   **warning** (scope change), not a regression — the gate judges the steps
   the trace covered.

## 7. Promotion-gate semantics (`verify --replay <trace>`)

For every aligned (name-matched), non-mocked step pair (recorded, fresh):

| recorded | fresh | verdict |
| -------- | ----- | ------- |
| pass     | pass  | OK |
| pass     | fail  | **REGRESSION** — blocks promotion (badge regeneration) |
| pass     | warn  | warning |
| warn     | anything | warning at most — warn-only steps never block |
| fail     | anything | informational — the recorded run was already failing; promotion was never green |

Rules:

- **Regression = a recorded-pass step that now fails, or that no longer runs at all.**
  That is the only blocking condition. It answers Hone's question: "did the change break
  something that worked?" A vanished step is silent coverage loss — re-record the trace
  to bless a legitimate rename.
- **Output-only divergences are warnings.** Same status, different detail
  (a reworded detail string, a new liveness URL) is noted, not blocking.
- **Mocked steps never block.** URL-liveness is warn-only by design (§2).
- Extra step names (fresh steps with no recorded counterpart) are warnings, not regressions (§6.5).
- A replay whose trace header `harness` differs from the current commit emits a
  warning ("trace recorded under a different harness build") but still gates —
  rejecting it outright would punish every harness upgrade.

## 8. Determinism

- `HARNESS_SEED` is the determinism knob. Recorded into the trace header on
  `--record`; restored into the environment on `--replay` before any phase
  runs.
- Walkthrough scripts receive the seed via env (`HARNESS_SEED`), alongside
  the existing `HARNESS_SKILL_DIR`. Walkthroughs that want deterministic
  behavior should seed their PRNG from it; the harness cannot force
  determinism on a script that ignores the knob.
- Seed is a string, not a number: anything the walkthrough can consume
  (`"42"`, `"wave300"`) is valid. Empty string = "no seed requested".

## 9. Backward compatibility

- **Zero new dependencies.** `lib/scrub.mjs` is pure regex; `lib/trace.mjs`
  uses `node:fs` and `node:path` only.
- No existing command's behavior changes. The recorder is a wrapper; recording
  does not alter check or smoke semantics, verdict rules, badge output, or
  CLI flags.
- Trace files are additive: `traces/` is a new directory; nothing existing
  reads it, so no existing consumer can break.
- `scrubSecrets` is safe on non-strings (returns as-is) so it cannot crash a
  recorder on an unexpected detail type.

## 10. Open questions for the coordinator

- Who owns `--replay`'s mock injection: skip-before-run (faster) or run-and-ignore (measures divergence)?
- Should the trace also hash skill content (e.g. SKILL.md digest) to detect the skill changing between record and replay? Currently the trace binds skill+version only.
- Retention policy for `traces/` (cap by count/age?) — currently unbounded.
