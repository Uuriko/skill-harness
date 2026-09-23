// Smoke tests: actually exercise the skill instead of just reading it.
//
// Two layers:
//  1. Generic checks any skill gets: bundled scripts still parse
//     (node --check / bash -n / python -m py_compile), and non-templated
//     http(s) URLs referenced in SKILL.md respond (liveness, warn-only).
//  2. Per-skill walkthrough scripts in smoke-scripts/<name>.smoke.mjs that
//     follow the skill's own procedure end-to-end (the strongest signal:
//     an agent executing the instructions for real).
//
// Smoke scripts are HARNESS-owned, never skill-owned: a skill must not be
// able to ship its own passing test.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { execFile } from "node:child_process";

const URL_RE = /\bhttps?:\/\/[^\s"'`<>()\]]+/g;
const TEMPLATED_RE = /[{<*]|example\.(com|org|net)|\.\.\.|…/;
const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/;

function listScripts(skillDir) {
  const out = [];
  for (const sub of ["scripts", ""]) {
    const dir = join(skillDir, sub);
    if (!existsSync(dir)) continue;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name);
      if ([".mjs", ".js", ".cjs", ".sh", ".py"].includes(ext)) out.push(join(dir, e.name));
    }
  }
  return out;
}

function checkScript(path) {
  const ext = extname(path);
  const cmd = ext === ".py" ? ["python3", ["-m", "py_compile", path]]
    : ext === ".sh" ? ["bash", ["-n", path]]
    : ["node", ["--check", path]];
  return new Promise(resolve => {
    execFile(cmd[0], cmd[1], { timeout: 15000 }, err => {
      resolve({ name: `script-syntax: ${basename(path)}`, ok: !err, detail: err ? String(err.message).split("\n")[0] : "parses" });
    });
  });
}

async function urlLiveness(skillDir) {
  const text = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const urls = [...new Set([...text.matchAll(URL_RE)].map(m => m[0].replace(/[.,;:!?]+$/, "")))]
    .filter(u => !TEMPLATED_RE.test(u) && !LOCAL_RE.test(u));
  const steps = [];
  for (const u of urls.slice(0, 25)) {
    let ok = false, detail = "";
    for (const method of ["HEAD", "GET"]) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(u, { method, signal: ctrl.signal, redirect: "follow" });
        clearTimeout(t);
        ok = r.status < 500;
        detail = `${method} ${r.status}`;
        if (ok || r.status === 405) break;
      } catch (e) {
        detail = `${method} ${e.name === "AbortError" ? "timeout" : e.message.split("\n")[0]}`;
      }
    }
    // Liveness is warn-only: the open web flakes. Recorded, never fatal.
    steps.push({ name: `url-liveness: ${u}`, ok, warnOnly: true, detail });
  }
  if (urls.length === 0) steps.push({ name: "url-liveness", ok: true, detail: "no concrete URLs referenced" });
  return steps;
}

export async function runSmoke(skillDir, { skillName, harnessRoot, timeoutMs = 120000 } = {}) {
  const steps = [];

  // Layer 1a: bundled scripts parse.
  const scripts = listScripts(skillDir);
  for (const s of scripts) steps.push(await checkScript(s));
  if (scripts.length === 0) steps.push({ name: "script-syntax", ok: true, detail: "no bundled scripts" });

  // Layer 1b: referenced URLs are alive (warn-only).
  steps.push(...await urlLiveness(skillDir));

  // Layer 2: per-skill walkthrough, if the harness ships one.
  const walkthrough = harnessRoot ? join(harnessRoot, "smoke-scripts", `${skillName}.smoke.mjs`) : null;
  if (walkthrough && existsSync(walkthrough)) {
    steps.push(...await runWalkthrough(walkthrough, skillDir, timeoutMs));
  } else {
    steps.push({ name: "walkthrough", ok: true, detail: "no harness walkthrough script for this skill" });
  }

  const fatalFails = steps.filter(s => !s.ok && !s.warnOnly);
  return { steps, passed: fatalFails.length === 0 };
}

function runWalkthrough(scriptPath, skillDir, timeoutMs) {
  return new Promise(resolve => {
    execFile("node", [scriptPath], {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, HARNESS_SKILL_DIR: skillDir },
    }, (err, stdout, stderr) => {
      const steps = [];
      for (const line of String(stdout).split("\n")) {
        const m = line.match(/^(PASS|FAIL)\s+(.+?)(?::\s+(.*))?$/);
        if (m) steps.push({ name: `walkthrough: ${m[2].trim()}`, ok: m[1] === "PASS", detail: (m[3] || "").trim().slice(0, 200) });
      }
      if (steps.length === 0) {
        steps.push({
          name: "walkthrough", ok: false,
          detail: (err ? `errored: ${String(err.message).split("\n")[0]}` : "no PASS/FAIL lines emitted") +
            (stderr ? ` | stderr: ${String(stderr).split("\n").slice(-3).join(" ").slice(0, 200)}` : ""),
        });
      }
      resolve(steps);
    });
  });
}
