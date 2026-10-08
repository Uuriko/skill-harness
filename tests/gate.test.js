// Promotion-gate tests (WAVE-300, Worker 3: record / replay / gate).
// Exercises the gate through the real CLI via child_process — no mocks.
// Run: node --test tests/gate.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const BIN = join(ROOT, "bin", "harness.mjs");
const FIXTURE = join(HERE, "fixtures", "replay", "fixture-skill");

function harness(args, env = {}) {
  return spawnSync("node", [BIN, ...args], {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, ...env },
  });
}

test("gate: verify --record exits 0 and writes a trace with a header line", () => {
  const tmp = mkdtempSync(join(tmpdir(), "gate-record-"));
  const tracePath = join(tmp, "t.jsonl");
  const r = harness(["verify", FIXTURE, "--record", tracePath]);
  assert.equal(r.status, 0, `verify --record failed:\n${r.stdout}\n${r.stderr}`);
  assert.ok(existsSync(tracePath), "trace file was not written");
  const firstLine = readFileSync(tracePath, "utf8").split("\n")[0];
  const header = JSON.parse(firstLine);
  assert.equal(header.v, 1);
  assert.equal(header.type, "header");
  assert.equal(header.skill, "fixture-skill");
});

test("gate: verify --replay against a fresh record is clean (exit 0)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "gate-clean-"));
  const tracePath = join(tmp, "t.jsonl");
  const rec = harness(["verify", FIXTURE, "--record", tracePath]);
  assert.equal(rec.status, 0, `record failed:\n${rec.stdout}\n${rec.stderr}`);
  const gate = harness(["verify", FIXTURE, "--replay", tracePath]);
  assert.equal(gate.status, 0, `replay gate failed on clean fixture:\n${gate.stdout}\n${gate.stderr}`);
  assert.match(gate.stdout + gate.stderr, /replay gate: CLEAN/);
});

test("gate: a smoke-step break that static checks miss blocks promotion (exit 1)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "gate-break-"));
  // Record the good trace against the pristine fixture (copied so nothing mutates).
  // Copies keep the leaf dir name "fixture-skill" so name-matches-dir stays green.
  const goodDir = join(tmp, "good", "fixture-skill");
  cpSync(FIXTURE, goodDir, { recursive: true });
  const tracePath = join(tmp, "good.trace.jsonl");
  const rec = harness(["verify", goodDir, "--record", tracePath]);
  assert.equal(rec.status, 0, `record failed:\n${rec.stdout}\n${rec.stderr}`);

  // Break the copy: corrupt the bundled script so node --check fails.
  // Static checks never parse bundled scripts (file-references-resolve only
  // checks existence), so `check` stays green — the break is invisible to them.
  const brokenDir = join(tmp, "broken", "fixture-skill");
  cpSync(FIXTURE, brokenDir, { recursive: true });
  appendFileSync(join(brokenDir, "scripts", "ok.mjs"), "\nthis is not valid javascript {{{ \n");

  const check = harness(["check", brokenDir]);
  assert.equal(check.status, 0, `static checks should miss the script break:\n${check.stdout}\n${check.stderr}`);

  const gate = harness(["verify", brokenDir, "--replay", tracePath]);
  assert.notEqual(gate.status, 0, "gate should exit non-zero on the broken copy");
  assert.match(gate.stdout + gate.stderr, /replay gate FAILED/);
  assert.match(gate.stdout + gate.stderr, /script-syntax: ok\.mjs/);
  assert.match(gate.stdout + gate.stderr, /badge not regenerated/);
});
