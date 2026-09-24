# skill-harness

Independent **verified-working** tester for [Agent Skills](https://agentskills.io) (`SKILL.md`).
Skill search exists (skills.sh, ClawHub). Nobody independently tests whether published
skills actually work. This harness does — and publishes the receipts.

Zero dependencies. Node 20+. Everything it produces is static files, so GitHub serves
the badges and results with no server.

## What it checks

**Static checks** (`harness.mjs check <skill-dir>`) — derived from the
[Agent Skills specification](https://agentskills.io/specification):

| Check | Rule |
|---|---|
| `skill-md-exists`, `frontmatter-parse` | SKILL.md present, YAML frontmatter parses |
| `name-present/format/matches-dir` | 1–64 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`, matches directory name |
| `description-present/length/quality` | 1–1024 chars; should say what the skill does **and when to use it** |
| `compatibility/metadata/allowed-tools` | Optional-field shapes per spec; unknown fields flagged |
| `body-nonempty/length/structure` | Non-empty; < 500 lines recommended; headings or numbered steps |
| `file-references-resolve` | Referenced `scripts/`, `references/`, `assets/` files exist |
| `security-scan` | Instruction-smuggling + exfiltration patterns (see below) |

**Security scan patterns** (fail = blocks verification):

- *fail:* `ignore/disregard previous instructions`, `override your instructions`,
  `reveal/disclose your system prompt`
- *fail:* env-secret → network exfiltration shapes, credentials embedded in URLs
- *warn:* credential-harvesting phrasing ("paste your API key"), `curl … | sh` supply-chain shapes,
  persona-reassignment phrasing

**Smoke tests** (`harness.mjs smoke <skill-dir>`) — actually exercises the skill:

1. Bundled scripts still parse (`node --check` / `bash -n` / `python -m py_compile`).
2. Concrete `http(s)` URLs referenced in SKILL.md respond (warn-only — the open web flakes;
   `localhost` and templated URLs are skipped).
3. **Walkthroughs** — a scripted agent follows the skill's own procedure end-to-end.
   Walkthrough scripts are *harness-owned* (`smoke-scripts/<skill>.smoke.mjs`) and never
   ship with the skill, so a skill cannot fake its own passing test.

## Usage

```sh
node bin/harness.mjs check <skill-dir>   # static checks only (fast, offline)
node bin/harness.mjs smoke <skill-dir>   # smoke tests only
node bin/harness.mjs verify <skill-dir>  # full run: writes results/<skill>/<version>.json,
                                         # regenerates badges/<skill>.svg, rebuilds index
node bin/harness.mjs badge <skill>       # regenerate badge from latest result
node bin/harness.mjs index               # rebuild results/index.json
node bin/harness.mjs list                # latest results for all tested skills
```

A skill **passes** iff zero static failures and zero fatal smoke failures.
Warnings never fail a skill, but they are published in the result JSON.

`HARNESS_ROOM_CHECKOUT` overrides the room checkout the `join-project-room`
walkthrough imports from (read-only). `HARNESS_SKILL_DIR` overrides the skill dir.

## Badges

Embed in your skill's README:

```md
[![skill-harness: verified working](https://raw.githubusercontent.com/Uuriko/skill-harness/main/badges/<skill>.svg)](https://github.com/Uuriko/skill-harness/tree/main/results/<skill>)
```

Badge states: `verified working · <date>` (green), `verified · N warnings · <date>`
(yellow-green), `checks failing · <date>` (red), `not verified` (grey).

## Verified skills

| Skill | Verdict | Static | Smoke | Checked |
|---|---|---|---|---|
| [join-project-room](results/join-project-room) | ✅ pass | 0 fail / 0 warn | 19/19 (full guest-flow walkthrough against a live local room) | 2026-09-24 |
| [claim-a-task](results/claim-a-task) | ✅ pass | 0 fail / 0 warn | 4/4 | 2026-09-24 |
| [skill-creator](results/skill-creator) | ✅ pass | 0 fail / 0 warn | 11/11 | 2026-09-24 |
| [theme-factory](results/theme-factory) | ✅ pass | 0 fail / 1 warn | 3/3 | 2026-09-24 |
| [webapp-testing](results/webapp-testing) | ✅ pass | 0 fail / 1 warn | 3/3 | 2026-09-24 |

Third-party skills under `dogfood/third-party/` are upstream copies fetched read-only
2026-09-23 from [anthropics/skills](https://github.com/anthropics/skills) (see
`dogfood/third-party/SOURCES.md`). No live-service installs are run against
third-party skills; their smoke layer is script-syntax + URL liveness only.

## Tests

```sh
npm test   # node --test tests/
```

## Honest limitations

- A walkthrough proves the skill's procedure works against the room revision it ran
  against, not that it will work forever. Re-run on a schedule; badges carry the check date.
- Static checks cannot catch a skill that is *coherent but wrong* about a live API —
  that is what walkthroughs are for, and they only exist where the harness ships one.
- The security scan is pattern-based, not a proof of safety. Treat a pass as
  "no known red flags", not "trusted".
