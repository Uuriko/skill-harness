// guild-18 regression tests: static-check mutants M7/M9.
// Run: node --test tests/mutant-reg-static.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const { runStaticChecks } = await import(join(ROOT, "lib/static-checks.mjs"));

function mkSkill(name, skillMd) {
  const base = mkdtempSync(join(tmpdir(), "mutreg-"));
  const d = join(base, name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "SKILL.md"), skillMd);
  return d;
}
const byId = checks => Object.fromEntries(checks.map(c => [c.id, c]));

// M7: exactly-1024-char description is spec-legal (mutant `< 1024` fails it).
test("mutant-reg: 1024-char description passes description-length", () => {
  const desc = "Use this when testing boundaries. " + "x".repeat(1024 - 34);
  assert.equal(desc.length, 1024);
  const d = mkSkill("ok-skill", `---\nname: ok-skill\ndescription: "${desc}"\n---\n\n# T\n\n## Step 1\n\nDo it.\n`);
  const c = byId(runStaticChecks(d));
  assert.equal(c["description-length"].status, "pass");
});

// M9: leading/trailing/double hyphens must fail name-format
// (mutant `/^[a-z0-9-]+$/` accepts them).
for (const bad of ["-bad-", "bad--x", "-"]) {
  test(`mutant-reg: name-format rejects ${JSON.stringify(bad)}`, () => {
    const d = mkSkill("some-dir", `---\nname: ${bad}\ndescription: "Use this when testing name boundaries: it is intentionally malformed."\n---\n\n# T\n`);
    const c = byId(runStaticChecks(d));
    assert.equal(c["name-format"].status, "fail");
  });
}
