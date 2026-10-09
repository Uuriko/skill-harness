# lib/frontmatter.mjs — module doc

**Purpose.** Dependency-free YAML-subset parser, just enough for SKILL.md frontmatter.
Exports: `splitFrontmatter(text)`, `parseYamlSubset(raw)`, `parseFrontmatter(text)`.

## API

### `splitFrontmatter(text) -> { ok, raw?, body?, error? }`
- Splits `---\n<frontmatter>\n---\n<body>` via the regex
  `/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/`.
- `ok:false` with `"missing frontmatter delimiters (--- ... ---)"` when the
  delimiters are absent or malformed.
- **Gotcha:** a BOM (`\uFEFF`) before the first `---` breaks the `^---` anchor,
  so a BOM-prefixed SKILL.md fails with "missing frontmatter delimiters"
  (fuzz F9). CRLF line endings are handled (`\r?\n`).

### `parseYamlSubset(raw) -> { ok, value?, error? }`
Hand-rolled indentation parser. Supports:
- `key: value` — plain, single-quoted (`'it''s'` → `it's`), double-quoted
  (`"a: b"`, with `\"`, `\\`, `\n` escapes) scalars.
- Nested maps via indentation (`metadata:` followed by indented keys).
- Literal `|` (newline-joined) and folded `>` (space-joined, blank-line
  preserving) block scalars. Block content must be indented ≥ parent indent + 2.
- `#` comments: full-line comments skipped; trailing ` # comment` stripped
  from *unquoted* plain scalars only (quoted values keep their `#`).
- Anything else → `{ ok:false, error: "unparseable line: ..." }` (first 60 chars).

Key algorithm detail — the dedent loop:
```js
while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
```
A key at the *same* indent as the current map's parent closes the nested map
(`<=`, not `<`). Mutation M1 proved the suite never exercises this:
`a:\n  x: 1\nb: 2` with `<` would nest `b` under `a` and no test would catch it.

### `parseFrontmatter(text) -> { ok, data?, body?, error? }`
`splitFrontmatter` then `parseYamlSubset`. `data` is the parsed map,
`body` the Markdown after the closing delimiter.

## Limitations (documented behavior, not bugs)
- No lists/sequences, no anchors, no multi-document, no explicit types —
  values are always strings or nested string maps.
- Duplicate keys: last write wins, silently.
- Keys are restricted to `[A-Za-z0-9_.-]+`; anything else is "unparseable".
- Tab indentation is not treated as indentation (indent measured in spaces);
  tab-indented lines are likely to misparse or error.
- **Fail-open gap (fuzz F2, real bug):** an *unclosed* quote
  (`description: "never closed`) is silently accepted as a plain scalar
  *including the quote character*, and `frontmatter-parse` reports PASS.
  Strict YAML would reject it. See `findings/guild-18/bugs.md`.

## Test coverage
`tests/harness.test.js`: parses name/description/metadata map; rejects missing
delimiters; quoted description containing a colon. Regression tests on this
branch (`tests/mutant-reg-frontmatter.test.js`): literal `|` preserves
newlines; unclosed quote is rejected (fail-first for the F2 bug).
