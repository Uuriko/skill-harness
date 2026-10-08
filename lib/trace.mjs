// Trace recorder for the replay harness.
//
// recordVerifyTrace() wraps a verify run's static checks + smoke results and
// serializes them as a v1 JSONL trace (see docs/REPLAY-HARNESS.md):
//   line 1: header  {"v":1,"type":"header","skill","version","seed","harness","startedAt"}
//   lines 2..N+1: step lines, checks first then smoke, seq 1..N
//   last line: footer {"v":1,"type":"footer","status","steps","endedAt"}
//
// Zero dependencies beyond node:fs and node:path.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrubSecrets } from "./scrub.mjs";

const FORMAT_VERSION = 1;

function utcStamp(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

// A step name is mockable iff it is a network-liveness probe: names starting
// with "url" (covers both "url:" and the current "url-liveness:" prefix).
function isMocked(name) {
  return typeof name === "string" && name.startsWith("url");
}

function smokeStatus(step) {
  if (step.ok) return "pass";
  return step.warnOnly ? "warn" : "fail";
}

function stepLine(seq, phase, name, status, detail, mocked) {
  return JSON.stringify({
    v: FORMAT_VERSION,
    type: "step",
    seq,
    phase,
    name,
    status,
    detail: scrubSecrets(detail),
    mocked,
  });
}

export function recordVerifyTrace({ harnessRoot, skill, version, seed, harnessCommit, checks, smoke, outPath }) {
  const startedAt = new Date().toISOString();
  const lines = [];
  lines.push(JSON.stringify({
    v: FORMAT_VERSION,
    type: "header",
    skill,
    version,
    seed: seed ?? "",
    harness: harnessCommit,
    startedAt,
  }));

  let seq = 0;
  let failed = false;

  for (const check of checks || []) {
    seq += 1;
    const status = check.status;
    if (status === "fail") failed = true;
    // Current static-checks.mjs emits `id`; the brief's `name` may arrive later.
    const name = check.name ?? check.id ?? `check-${seq}`;
    lines.push(stepLine(seq, "check", name, status, check.detail, false));
  }

  for (const step of (smoke && smoke.steps) || []) {
    seq += 1;
    const status = smokeStatus(step);
    if (status === "fail") failed = true;
    lines.push(stepLine(seq, "smoke", step.name, status, step.detail, isMocked(step.name)));
  }

  lines.push(JSON.stringify({
    v: FORMAT_VERSION,
    type: "footer",
    status: failed ? "fail" : "pass",
    steps: seq,
    endedAt: new Date().toISOString(),
  }));

  const out = outPath || join(harnessRoot, "traces", `${skill}-${version}-${utcStamp()}.trace.jsonl`);
  mkdirSync(join(harnessRoot, "traces"), { recursive: true });
  writeFileSync(out, lines.join("\n") + "\n", "utf8");
  return out;
}
