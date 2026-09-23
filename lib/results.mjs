// Results store + SVG badges. Everything is static files: results/<skill>/<version>.json,
// results/index.json, badges/<skill>.svg. No server needed — GitHub raw serves the badges.

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";

export function skillVersion(skillDir) {
  try {
    return execFileSync("git", ["-C", skillDir, "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return "local"; }
}

export function writeResult(harnessRoot, { skill, version, staticChecks, smoke }) {
  const staticFails = staticChecks.filter(c => c.status === "fail").length;
  const staticWarns = staticChecks.filter(c => c.status === "warn").length;
  const verdict = staticFails === 0 && (!smoke || smoke.passed) ? "pass" : "fail";
  const result = {
    skill,
    version,
    checked_at: new Date().toISOString(),
    harness: "skill-harness",
    verdict,
    static: { fails: staticFails, warns: staticWarns, checks: staticChecks },
    smoke: smoke ? {
      passed: smoke.passed,
      steps: smoke.steps.map(s => ({ name: s.name, ok: s.ok, warn_only: !!s.warnOnly, detail: s.detail })),
    } : null,
  };
  const dir = join(harnessRoot, "results", skill);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${version}.json`), JSON.stringify(result, null, 2) + "\n");
  return result;
}

export function rebuildIndex(harnessRoot) {
  const resultsDir = join(harnessRoot, "results");
  const index = { updated_at: new Date().toISOString(), skills: {} };
  if (!existsSync(resultsDir)) return index;
  for (const skill of readdirSync(resultsDir)) {
    const dir = join(resultsDir, skill);
    let files = [];
    try { files = readdirSync(dir).filter(f => f.endsWith(".json")); } catch { continue; }
    let latest = null, latestMtime = 0;
    for (const f of files) {
      const p = join(dir, f);
      let mtime = 0;
      try { mtime = statSync(p).mtimeMs; } catch { continue; }
      if (mtime >= latestMtime) { latestMtime = mtime; latest = f; }
    }
    if (latest) {
      try {
        const r = JSON.parse(readFileSync(join(dir, latest), "utf8"));
        index.skills[skill] = {
          verdict: r.verdict, version: r.version, checked_at: r.checked_at,
          static_fails: r.static.fails, static_warns: r.static.warns,
          smoke_passed: r.smoke ? r.smoke.passed : null,
          smoke_steps: r.smoke ? r.smoke.steps.length : 0,
        };
      } catch { /* corrupt result file: skip */ }
    }
  }
  writeFileSync(join(resultsDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  return index;
}

// --- SVG badges ---

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COLORS = {
  pass: "#4c1",        // brightgreen
  warn: "#a4a61d",     // yellowgreen
  fail: "#e05d44",     // red
  unknown: "#9f9f9f",  // lightgrey
};

export function badgeSvg({ verdict, checkedAt, warns = 0 }) {
  const state = verdict === "pass" && warns > 0 ? "warn" : verdict;
  const color = COLORS[state] || COLORS.unknown;
  const date = (checkedAt || "").slice(0, 10);
  const left = "skill harness";
  const right = state === "pass" ? `verified working · ${date}`
    : state === "warn" ? `verified · ${warns} warning${warns === 1 ? "" : "s"} · ${date}`
    : state === "fail" ? `checks failing · ${date}`
    : "not verified";
  // Shields-style flat badge, widths estimated at ~6.2px/char.
  const lw = Math.round(left.length * 6.2) + 12;
  const rw = Math.round(right.length * 6.2) + 12;
  const w = lw + rw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">` +
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>` +
    `<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>` +
    `<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/><rect width="${w}" height="20" fill="url(#s)"/></g>` +
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">` +
    `<text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(left)}</text><text x="${lw / 2}" y="14">${esc(left)}</text>` +
    `<text x="${lw + rw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(right)}</text><text x="${lw + rw / 2}" y="14">${esc(right)}</text>` +
    `</g></svg>\n`;
}

export function writeBadge(harnessRoot, skill, { verdict, checkedAt, warns }) {
  const dir = join(harnessRoot, "badges");
  mkdirSync(dir, { recursive: true });
  const svg = badgeSvg({ verdict, checkedAt, warns });
  writeFileSync(join(dir, `${skill}.svg`), svg);
  return svg;
}

export function badgeMarkdown(skill) {
  const raw = `https://raw.githubusercontent.com/Uuriko/skill-harness/main/badges/${skill}.svg`;
  const results = `https://github.com/Uuriko/skill-harness/tree/main/results/${skill}`;
  return `[![skill-harness: verified working](${raw})](${results})`;
}
