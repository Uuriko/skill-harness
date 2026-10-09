# Badge lifecycle

**Purpose of the badge.** A public, embeddable claim: "skill-harness verified
this skill working on <date>". Served as a static SVG via GitHub raw; no
server, no signing.

## Lifecycle
1. **Born** — `harness verify <skill-dir>` (or `harness badge <name>`)
   calls `writeBadge(harnessRoot, skill, { verdict, checkedAt, warns })`.
2. **Rendered** — `badgeSvg` picks state: `pass`+warns>0 → `warn` (yellow-green),
   else the verdict (`pass` green / `fail` red / anything else grey
   "not verified"). Right-hand text embeds the check date (`checked_at`
   truncated to YYYY-MM-DD) and warn count.
3. **Stored** — `badges/<skill>.svg`, committed to the repo (the weekly
   re-verify cron commits refreshed badges).
4. **Served** — `https://raw.githubusercontent.com/Uuriko/skill-harness/main/badges/<skill>.svg`
   (note: hardcoded `main` branch in `badgeMarkdown`).
5. **Embedded** — `badgeMarkdown(skill)` returns
   `[![skill-harness: verified working](<raw svg>)](<results tree link>)`
   for skill READMEs.
6. **Regenerated** — `harness badge <name>` rebuilds the index, looks up the
   latest result for `<name>`, and rewrites the SVG. Unknown name → stderr +
   exit 1, no file written.
7. **Stale** — nothing auto-expires a badge. A badge dated 2026-09-24 stays
   green until the next verify overwrites it. Staleness is visible only via
   the embedded date.

## Concurrency
`writeBadge` is `mkdir -p` + one `writeFileSync` — atomic enough at this
scale. 10 concurrent `badge` invocations: all exit 0, final SVG valid
(fuzz F7). No locking; last writer wins, which is fine because all writers
derive from the same latest result.

## Security notes
- All interpolated text is HTML-escaped (`esc()`); a skill named
  `<script>` cannot inject markup into the SVG (and such a name could never
  reach the badge writer anyway — see below).
- **Filename safety:** `writeBadge` does no sanitization of `skill`, but both
  CLI paths are safe: `verify` uses `basename(skillDir)`, and `badge <name>`
  exits 1 before writing unless `<name>` is a key in the rebuilt index
  (fuzz F8: `../../` traversal confirmed unreachable).
- The badge is **unsigned and unversioned**: anyone can copy the SVG. The
  trust anchor is the repo + the result JSON behind the embed link, not the
  pixels.

## Gotchas
- Warn-state badges (`pass` with warnings) are yellow-green, not green — a
  consumer scanning for green will notice.
- `badge` regenerates from the *index's* latest result, which is latest by
  **file mtime**, not by `checked_at` or version.
- The embed markdown always points at `main`, even when badges are generated
  on a branch.
