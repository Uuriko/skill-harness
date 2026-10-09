// guild-18 regression test: CLI exit-code mutants M14/M15.
// Runs bin/harness.mjs from a SCRATCH copy so verify's results/badges writes
// never touch the real tree (weekly reverify cron state).
// Run: node --test tests/mutant-reg-cli.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const fixture = n => join(HERE, "fixtures", n);

function scratchHarness() {
  const s = mkdtempSync(join(tmpdir(), "mutreg-cli-"));
  execFileSync("cp", ["-r", join(ROOT, "bin"), join(s, "bin")]);
  execFileSync("cp", ["-r", join(ROOT, "lib"), join(s, "lib")]);
  execFileSync("cp", [join(ROOT, "package.json"), join(s, "package.json")]);
  mkdirSync(join(s, "results")); mkdirSync(join(s, "badges")); mkdirSync(join(s, ".tmp"));
  return s;
}
function runCli(scratch, args, timeout = 120000) {
  try {
    execFileSync("node", [join(scratch, "bin/harness.mjs"), ...args], {
      timeout, encoding: "utf8",
      env: { ...process.env, TMPDIR: join(scratch, ".tmp") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return 0;
  } catch (e) { return e.status ?? 99; }
}

// M14: verify on a failing skill must exit 1 (mutant flips to exit 0).
test("mutant-reg: verify on failing skill exits 1", () => {
  const s = scratchHarness();
  const code = runCli(s, ["verify", fixture("sneaky-skill")]);
  assert.equal(code, 1);
}, { timeout: 180000 });

// M15: check on a failing skill must exit 1 (mutant flips to exit 0).
test("mutant-reg: check on a failing skill exits 1", () => {
  const s = scratchHarness();
  const code = runCli(s, ["check", fixture("sneaky-skill")]);
  assert.equal(code, 1);
}, { timeout: 180000 });

// Sanity: check on the good fixture exits 0 (guards against overcorrection).
test("mutant-reg: check on passing skill exits 0", () => {
  const s = scratchHarness();
  const code = runCli(s, ["check", fixture("good-skill")]);
  assert.equal(code, 0);
}, { timeout: 180000 });
