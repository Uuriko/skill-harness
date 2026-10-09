// guild-18 regression tests: frontmatter mutants M2 (+ F2 fuzz bug).
// Run: node --test tests/mutant-reg-frontmatter.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const { parseFrontmatter } = await import(join(ROOT, "lib/frontmatter.mjs"));

// M2: literal `|` block scalar must preserve newlines (mutant joins with " ").
test("mutant-reg: literal block scalar preserves newlines", () => {
  const r = parseFrontmatter("---\ndesc: |\n  line1\n  line2\n---\nbody\n");
  assert.equal(r.ok, true);
  assert.equal(r.data.desc, "line1\nline2");
});

// F2 (real bug, fuzz-found): an unclosed quote must NOT parse as a plain scalar.
// Currently FAILS on the shipped code (fail-open: the quote is kept verbatim and
// frontmatter-parse reports PASS). Skipped until the bug is fixed; the standalone
// repro lives in findings/guild-18/bugs.md.
test("mutant-reg: unclosed double quote is rejected", { skip: "F2 bug: unclosed quote currently accepted (see findings/guild-18/bugs.md)" }, () => {
  const r = parseFrontmatter('---\ndescription: "never closed\n---\nbody\n');
  assert.equal(r.ok, false);
});

test("mutant-reg: unclosed single quote is rejected", { skip: "F2 bug: unclosed quote currently accepted (see findings/guild-18/bugs.md)" }, () => {
  const r = parseFrontmatter("---\ndescription: 'never closed\n---\nbody\n");
  assert.equal(r.ok, false);
});
