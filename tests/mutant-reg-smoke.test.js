// guild-18 regression test: smoke mutant M11 (warn-only must stay non-fatal).
// Hermetic: global fetch is stubbed to fail, so the url-liveness step fails
// warn-only without touching the network (no sockets, no 8s aborts, no hangs).
// Run: node --test tests/mutant-reg-smoke.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);

// Stub fetch BEFORE importing smoke.mjs (it calls the global at call time).
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("simulated network failure"); };
const { runSmoke } = await import(join(ROOT, "lib/smoke.mjs"));
globalThis.fetch = realFetch;

test("mutant-reg: warn-only liveness failure does not fail smoke", async () => {
  const d = mkdtempSync(join(tmpdir(), "mutreg-smoke-"));
  writeFileSync(join(d, "SKILL.md"),
    `---\nname: dead-url-skill\ndescription: "Use this when testing warn-only liveness: its URL is stubbed dead."\n---\n\n# T\n\nSee https://dead-url-test.invalid/unreachable for details.\n`);
  const stub = async () => { throw new Error("simulated network failure"); };
  globalThis.fetch = stub;
  let smoke;
  try {
    smoke = await runSmoke(d, { skillName: "dead-url-skill", harnessRoot: null, timeoutMs: 60000 });
  } finally {
    globalThis.fetch = realFetch;
  }
  const live = smoke.steps.find(s => s.name.startsWith("url-liveness:"));
  assert.ok(live, "expected a url-liveness step");
  assert.equal(live.ok, false, "liveness step should fail (stubbed network)");
  assert.equal(live.warnOnly, true, "liveness step must be warn-only");
  // M11 drops `!s.warnOnly` from the fatal filter -> passed becomes false.
  assert.equal(smoke.passed, true, "warn-only failure must not fail the smoke run");
});
