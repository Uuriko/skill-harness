// Replay harness (WAVE-300): re-execute a recorded trace and diff it.
//
// Flow: Discover -> Replay -> Propose -> Promote. This module is the Replay
// step: given a v1 trace JSONL file (written by lib/trace.mjs), it re-runs
// the same checks and smoke tests against a skill directory and reports
// divergences between the recording and the re-execution.
//
// Gate semantics:
//   - kind "status" (pass<->fail flip) and kind "missing" fail the gate.
//   - kind "output" (same status, different detail) and kind "extra"
//     (re-executed step with no recorded counterpart) are reported only.
//   - recorded steps marked mocked (url liveness) are skipped: the network
//     is non-deterministic by design.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { runStaticChecks } from "./static-checks.mjs";
import { runSmoke } from "./smoke.mjs";

const LIVENESS_PREFIX = "url-liveness";

// Same mapping the recorder uses for smoke steps.
function smokeStatus(step) {
  if (step.ok) return "pass";
  return step.warnOnly ? "warn" : "fail";
}

function parseTrace(tracePath) {
  const raw = readFileSync(tracePath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (raw.length === 0) throw new Error("unsupported trace version");
  const lines = raw.map((line, i) => {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      throw new Error(`invalid trace: line ${i + 1} is not JSON`);
    }
    if (!obj || obj.v !== 1) throw new Error("unsupported trace version");
    return obj;
  });
  const header = lines[0];
  if (header.type !== "header") throw new Error("unsupported trace version");
  return { header, steps: lines.filter((l) => l.type === "step") };
}

function isMocked(step) {
  return step.mocked === true || String(step.name).startsWith(LIVENESS_PREFIX);
}

export async function replayTrace(tracePath, { skillDir, harnessRoot, timeoutMs = 120000 } = {}) {
  const { header, steps: recorded } = parseTrace(tracePath);

  const prevSeed = process.env.HARNESS_SEED;
  try {
    // Deterministic re-execution under the recorded seed.
    process.env.HARNESS_SEED = String(header.seed);

    // Re-execute only the phases the trace actually recorded.
    const phases = new Set(recorded.map((s) => s.phase));
    const rerun = [];
    if (phases.has("check")) {
      for (const c of runStaticChecks(skillDir)) {
        rerun.push({ name: c.id, status: c.status, detail: c.detail });
      }
    }
    if (phases.has("smoke")) {
      const smoke = await runSmoke(skillDir, {
        skillName: basename(skillDir),
        harnessRoot,
        timeoutMs,
      });
      for (const s of smoke.steps) {
        if (s.name.startsWith(LIVENESS_PREFIX)) continue; // non-deterministic by design
        rerun.push({ name: s.name, status: smokeStatus(s), detail: s.detail });
      }
    }
    const rerunByName = new Map(rerun.map((s) => [s.name, s]));

    const divergences = [];
    const compared = new Set();
    let mocked = 0;
    let steps = 0;
    for (const rec of recorded) {
      if (isMocked(rec)) {
        mocked++;
        continue;
      }
      steps++;
      const act = rerunByName.get(rec.name);
      if (!act) {
        divergences.push({
          kind: "missing",
          seq: rec.seq,
          name: rec.name,
          expected: rec.status,
          actual: "absent",
        });
        continue;
      }
      compared.add(rec.name);
      if (act.status !== rec.status) {
        divergences.push({
          kind: "status",
          seq: rec.seq,
          name: rec.name,
          expected: rec.status,
          actual: act.status,
        });
      } else if ((act.detail ?? "") !== (rec.detail ?? "")) {
        divergences.push({
          kind: "output",
          seq: rec.seq,
          name: rec.name,
          expected: rec.detail,
          actual: act.detail,
        });
      }
    }
    for (const act of rerunByName.values()) {
      if (!compared.has(act.name)) {
        divergences.push({
          kind: "extra",
          seq: null,
          name: act.name,
          expected: "absent",
          actual: act.status,
        });
      }
    }

    const clean = !divergences.some((d) => d.kind === "status" || d.kind === "missing");
    return {
      clean,
      divergences,
      mocked,
      steps,
      recorded: { skill: header.skill, version: header.version, seed: header.seed },
    };
  } finally {
    if (prevSeed === undefined) delete process.env.HARNESS_SEED;
    else process.env.HARNESS_SEED = prevSeed;
  }
}
