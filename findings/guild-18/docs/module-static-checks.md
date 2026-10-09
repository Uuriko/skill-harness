# lib/static-checks.mjs — module doc

**Purpose.** Static (no-execution) checks for Agent Skills, derived from the
Agent Skills specification (agentskills.io/specification, fetched 2026-09-23).
Exports: `runStaticChecks(skillDir) -> checks[]`, `summarize(checks)`.

## Check model
Each check is `{ id, status: 'pass'|'warn'|'fail', detail }`.
**Verdict rule:** any `fail` ⇒ skill fails. `warn` never fails — it is reported
only (badge shows the warn state, see `docs/badge-lifecycle.md`).

`summarize(checks)` returns `{ fails, warns, verdict }`.

## Check catalog (in emission order)

| id | severity possible | what it does |
|---|---|---|
| `skill-md-exists` | fail | `SKILL.md` present at skill root. Missing → returns *only* this check (fail-fast). |
| `frontmatter-parse` | fail | `parseFrontmatter` must succeed. On failure → returns early (no further checks). |
| `name-present` | fail | `name` must be a non-empty string. |
| `name-format` | pass/fail | `/^[a-z0-9]+(-[a-z0-9]+)*$/`, 1–64 chars. Rejects leading/trailing/double hyphens, uppercase, underscores. |
| `name-matches-dir` | pass/fail | `name` must equal the skill directory's basename (spec requirement). |
| `description-present` | fail | `description` must be a non-empty string. |
| `description-length` | pass/fail | 1–1024 chars inclusive. Boundary 1024 is legal (mutation M7 proved untested before this branch's regression test). |
| `description-quality` | pass/warn | Requires a "use when…" cue (`/\b(used?\s+when|when\s+to\s+use|when\s+you\s+(need|want|have|hold|get|receive))\b/i`) **and** ≥40 chars. |
| `field-<k>` | warn | One per unknown frontmatter field (spec defines: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`). |
| `compatibility-length` | pass/warn | If present, 1–500 chars. |
| `metadata-shape` | pass/warn | If present, must be a string→string map (nested maps warn). |
| `allowed-tools-shape` | warn | If present and not a string → warn (should be space-separated string). |
| `body-nonempty` | fail | Markdown body after frontmatter must be non-empty. |
| `body-length` | pass/warn | ≤500 lines recommended; more → warn. |
| `body-structure` | pass/warn | Headings (`#{1,3}`) or numbered steps required, else warn. |
| `file-references-resolve` | pass/warn | Collects `` `scripts/...` ``, `` `references/...` ``, `` `assets/...` `` and `./`-relative Markdown links; missing targets → warn (not fail). |
| `security-scan` | pass/warn/fail | Runs `INJECTION_PATTERNS` + `EXFIL_PATTERNS` (below). Any `fail`-severity hit → check fails; warn-only hits → warn. Detail lists `[severity] id (line ~N): note`. |

## Security patterns
Deliberately tight to avoid false positives. Injection (instruction-smuggling
aimed at the *installing agent*): `ignore-previous-instructions`,
`disregard-instructions`, `override-instructions` (fail);
`jailbreak-persona` (`you are now …`, warn — note the negative lookahead
excludes `you are now … assistant`);
`reveal-system-prompt` (fail). Exfiltration: `paste-api-key` (warn),
`env-to-network` (`process.env|os.environ|getenv` within 120 chars before
`fetch|axios|requests.post|urllib|curl`, fail), `secret-in-url`
(`api_key|token|secret|password` = `http…`, fail), `pipe-to-shell`
(`curl|wget … | sh`, warn).

Only the **first** match per pattern is reported (`text.match`, not
`matchAll`) — a skill with 5 injection lines reports 1 finding per pattern.

## Gotchas
- Early returns: missing SKILL.md or unparseable frontmatter short-circuit;
  downstream checks never run (the CLI prints just 1–2 checks).
- `security-scan` regexes run against the *whole* SKILL.md (frontmatter +
  body), so a credential-looking string in frontmatter also trips exfil patterns.
- `file-references-resolve` only understands three backtick path prefixes and
  `./`-relative Markdown links; absolute links and bare URLs are ignored.
- Mutation M8 (severity flip) is killed by the sneaky-fixture test; M7/M9/M10
  boundary mutants survived until this branch's regression tests.
