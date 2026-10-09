// guild-18 regression test: results mutant M4.
// Run: node --test tests/mutant-reg-results.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const { writeResult } = await import(join(ROOT, "lib/results.mjs"));

// M4: exactly one static fail must still yield verdict "fail"
// (mutant `staticFails <= 1` lets it through as "pass").
test("mutant-reg: writeResult with 1 static fail => verdict fail", () => {
  const root = mkdtempSync(join(tmpdir(), "mutreg-results-"));
  mkdirSync(join(root, "results"), { recursive: true });
  const r = writeResult(root, {
    skill: "s", version: "v1",
    staticChecks: [{ id: "name-format", status: "fail", detail: "bad" }],
    smoke: null,
  });
  assert.equal(r.verdict, "fail");
});
