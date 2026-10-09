# Gotchas — skill-harness

Field notes from guild-18 verification (mutation + fuzz + re-verify).
Each item has a repro pointer.

## Parser
1. **Unclosed quotes are silently accepted** (real bug — `findings/guild-18/bugs.md`).
   `description: "never closed` parses OK with the quote kept in the value, and
   `frontmatter-parse` reports PASS. Repro: `node bin/harness.mjs check` on a
   skill with an unterminated quote → exit 0.
2. **BOM breaks the frontmatter anchor.** A `\uFEFF` before `---` fails with
   "missing frontmatter delimiters". Editors that add a BOM will produce a
   confusing error.
3. **Dedent uses `<=`, and nothing tests it.** `a:\n  x: 1\nb: 2` — the
   same-indent sibling must close the nested map. Mutation M1 survived.
4. **Duplicate keys: last wins, silently.** No warning.
5. **Tab indentation is not indentation.** Indent is measured in spaces only.

## Static checks
6. **Early returns hide signal.** Missing SKILL.md or unparseable frontmatter
   short-circuits — you get 1–2 checks, not the full catalog.
7. **Security scan reports the first hit per pattern only** (`String.match`,
   not `matchAll`). A skill with five injection lines shows one finding.
8. **Boundary values were untested pre-guild-18** (mutations M7/M9/M10):
   exactly-1024-char description, `-leading`/`trailing-`/`double--hyphen`
   names, exactly-500-line bodies. Regression tests added on this branch.

## Smoke
9. **No phase timeout on script-syntax.** Scripts are `node --check`ed
   sequentially (~0.3–0.4s each); 300 scripts blew a 120s budget (fuzz F11).
   `timeoutMs` only bounds the walkthrough child.
10. **URL liveness worst case ≈ 25 URLs × 2 methods × 8s ≈ 400s**, sequential.
    Warn-only, but the wall-clock is real.
11. **`smoke.mjs` had zero unit tests** pre-guild-18. The warn-only/fatal
    distinction (mutation M11) and the liveness threshold (M12) were
    untestable-by-construction until the regression tests on this branch.

## Results / badges / CLI
12. **`skillVersion` follows git upward.** A skill dir inside any repo reports
    the enclosing repo's SHA, not "local".
13. **Index "latest" is by file mtime**, not `checked_at` or version string.
    Equal-mtime tie-break is readdir-order-dependent and untested (M6).
14. **Badges never expire.** A green badge from September stays green until
    the next verify overwrites it; staleness shows only as the embedded date.
15. **Embed markdown hardcodes `main`.** Badges generated on a branch link
    `main`'s badge URL.
16. **CLI exit codes were untested** (M14/M15). A flipped `verify` exit would
    be a CI-green lie. Child-process regression test added on this branch.
17. **`badge <name>` traversal is not reachable** (fuzz F8): unknown names
    exit 1 before any write; known names come from `basename()` or the index.
18. **Dangling-symlink SKILL.md** exits 1 via the generic `main().catch`
    (stack-free message, but not a friendly one — ENOENT propagates from
    `runStaticChecks`).

## Dead-code audit (2026-10-08)
Method: every `export` in `lib/` + `bin/` grepped across `bin/ lib/ tests/
smoke-scripts/` (`.mjs` and `.js`).
**Result: no dead code.** Every export is imported by a live caller or a test:
- `parseFrontmatter`, `runStaticChecks`, `summarize`, `writeResult`,
  `rebuildIndex`, `badgeSvg` — imported by `tests/harness.test.js`.
- `runStaticChecks`, `summarize`, `runSmoke`, `skillVersion`, `writeResult`,
  `rebuildIndex`, `writeBadge`, `badgeMarkdown` — called by `bin/harness.mjs`.
- `parseFrontmatter` — called by `lib/static-checks.mjs`.
- `splitFrontmatter`, `parseYamlSubset` — exported but consumed only inside
  `lib/frontmatter.mjs` (by `parseFrontmatter`). Layered public API, not dead:
  they are the module's documented decomposition surface.
- `smoke-scripts/join-project-room.smoke.mjs` — no exports; invoked by
  `runSmoke`'s walkthrough lookup. Live.
