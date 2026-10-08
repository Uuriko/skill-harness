// Replay-harness tests (WAVE-300, Worker 2: replay runner).
// Run: node --test tests/replay.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { replayTrace } from "../lib/replay.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, "fixtures", "replay");
const FIXTURE_SKILL = join(FIXTURE_DIR, "fixture-skill");
const FIXTURE_TRACE = join(FIXTURE_DIR, "fixture-skill.trace.jsonl");
const HARNESS_ROOT = dirname(HERE); // worktree root: smoke-scripts/ lives here
const OPTS = { harnessRoot: HARNESS_ROOT, timeoutMs: 30000 };

test("replay: unmodified fixture replays clean with zero divergences", async () => {
  const r = await replayTrace(FIXTURE_TRACE, { skillDir: FIXTURE_SKILL, ...OPTS });
  assert.equal(r.clean, true);
  assert.deepEqual(r.divergences, []);
  assert.equal(r.mocked, 1, "the url-liveness step is skipped as non-deterministic");
  assert.ok(r.steps > 0, "compared steps are counted");
  assert.deepEqual(r.recorded, { skill: "fixture-skill", version: "fixture", seed: 42 });
});

test("replay: broken script syntax surfaces a status divergence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "replay-broken-"));
  try {
    // Copy under the same dir name so the name-matches-dir check still passes.
    const broken = join(dir, "fixture-skill");
    cpSync(FIXTURE_SKILL, broken, { recursive: true });
    writeFileSync(join(broken, "scripts", "ok.mjs"), "this is not valid javascript {{{{\n", { flag: "a" });
    const r = await replayTrace(FIXTURE_TRACE, { skillDir: broken, ...OPTS });
    assert.equal(r.clean, false);
    const d = r.divergences.find((x) => x.kind === "status");
    assert.ok(d, "expected a status divergence");
    assert.equal(d.name, "script-syntax: ok.mjs");
    assert.equal(d.expected, "pass");
    assert.equal(d.actual, "fail");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("replay: unsupported trace version throws", async () => {
  const dir = mkdtempSync(join(tmpdir(), "replay-badver-"));
  try {
    const bad = join(dir, "bad.trace.jsonl");
    writeFileSync(bad, '{"v":999,"type":"header","skill":"x","version":"y","seed":1,"harness":"z","startedAt":"2026-01-01T00:00:00Z"}\n');
    await assert.rejects(
      () => replayTrace(bad, { skillDir: FIXTURE_SKILL, ...OPTS }),
      /unsupported trace version/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("replay: HARNESS_SEED is restored after replay (success and throw paths)", async () => {
  const prev = process.env.HARNESS_SEED;
  try {
    process.env.HARNESS_SEED = "sentinel";
    await replayTrace(FIXTURE_TRACE, { skillDir: FIXTURE_SKILL, ...OPTS });
    assert.equal(process.env.HARNESS_SEED, "sentinel", "seed restored after clean replay");
    // Throw path: missing skillDir makes runSmoke throw mid-replay.
    await assert.rejects(
      () => replayTrace(FIXTURE_TRACE, { skillDir: join(tmpdir(), "no-such-skill-xyz"), ...OPTS })
    );
    assert.equal(process.env.HARNESS_SEED, "sentinel", "seed restored even when replay throws");
  } finally {
    if (prev === undefined) delete process.env.HARNESS_SEED;
    else process.env.HARNESS_SEED = prev;
  }
});
