# guild-18 confirmed bugs — skill-harness

## BUG CONFIRMED: skill-harness lib/frontmatter.mjs:unquote — unclosed quote silently accepted (fail-open parse)

- **Found by:** fuzz unit F2 (2026-10-08, wave1000 guild-18).
- **Severity:** low (verification-signal integrity, not RCE/data loss).
- **One-line:** an unterminated quote in SKILL.md frontmatter is silently
  accepted as a plain scalar and `frontmatter-parse` reports PASS.

### Repro
```
mkdir -p /tmp/f2skill
printf -- '---\nname: f2\ndescription: "never closed\n---\n\n# T\n' > /tmp/f2skill/SKILL.md
node bin/harness.mjs check /tmp/f2skill
echo "exit=$?"   # 0 — should be 1
```
Observed: `frontmatter-parse: [✓] Frontmatter parses.` and overall exit 0.
The parsed `description` is the 13-char string `"never closed` — quote
included. Same for single quotes (`'never closed`).

### Root cause
`unquote()` in `lib/frontmatter.mjs` only strips quotes when the value both
starts AND ends with the same quote character; otherwise it falls through and
returns the raw scalar verbatim. There is no "starts with a quote but doesn't
end with one" error path, so a typo'd quote becomes a silently corrupted value
under a green `frontmatter-parse` check.

### Why it matters
skill-harness is a *verification* tool: its `frontmatter-parse: PASS` signal
is consumed as "this frontmatter is well-formed". Fail-open parsing weakens
that signal — a skill author who typo'd a quote gets green checks on corrupted
metadata instead of a parse error pointing at the typo.

### Fail-first regression test
`tests/mutant-reg-frontmatter.test.js` contains two skipped tests asserting
`parseFrontmatter` returns `ok:false` for unclosed double/single quotes.
They are `skip`ped (not deleted) because they currently FAIL against the
shipped code — un-skip them when the bug is fixed and they become the
regression lock. (Fail-first proof: ran green-parse on the current tree;
the skip reason cites this file.)

### Suggested fix (for the repo owners; this guild does verification only)
In `unquote()`, treat a value that starts with `"`/`'` but doesn't end with
the matching quote as a parse error (return a sentinel and have
`parseYamlSubset` report `{ ok:false, error: "unterminated quote …" }`),
rather than falling through to the plain-scalar path.

---
*No other real defects found. Mutation testing (15 mutants) surfaced test gaps
only; fuzzing (15 inputs) surfaced this bug + one perf gap (F11, unbounded
script-syntax phase) + one driver error (F14). The suspected badge-path
traversal (F8) was proven unreachable — see `repro-traversal.mjs`.*
