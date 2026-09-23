#!/usr/bin/env node
// skill-harness CLI: independent verified-working tester for Agent Skills.
//
//   check <skill-dir>   static spec + security checks only (fast, offline)
//   smoke <skill-dir>   smoke tests only (scripts parse, URL liveness, walkthrough)
//   verify <skill-dir>  full run: static + smoke, writes results + badge + index
//   badge <skill>       regenerate the badge SVG from the latest result
//   index               rebuild results/index.json
//   list                show latest results for all tested skills

import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
import { existsSync } from "node:fs";
import { runStaticChecks, summarize } from "../lib/static-checks.mjs";
import { runSmoke } from "../lib/smoke.mjs";
import { writeResult, rebuildIndex, writeBadge, skillVersion, badgeMarkdown } from "../lib/results.mjs";

const HARNESS_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function usage() {
  console.log(`skill-harness — independent verified-working tester for Agent Skills

usage:
  harness.mjs check <skill-dir>   static checks only
  harness.mjs smoke <skill-dir>   smoke tests only
  harness.mjs verify <skill-dir>  full run + results + badge
  harness.mjs badge <skill-name>  regenerate badge from latest result
  harness.mjs index               rebuild results/index.json
  harness.mjs list                list latest results`);
  process.exit(2);
}

function fmtChecks(checks) {
  const icon = { pass: "✓", warn: "!", fail: "✗" };
  for (const c of checks) console.log(`  [${icon[c.status]}] ${c.id}: ${c.detail}`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (!cmd) usage();

  if (cmd === "index") {
    const idx = rebuildIndex(HARNESS_ROOT);
    console.log(`index rebuilt: ${Object.keys(idx.skills).length} skill(s)`);
    return;
  }

  if (cmd === "list") {
    const idx = rebuildIndex(HARNESS_ROOT);
    for (const [name, s] of Object.entries(idx.skills)) {
      console.log(`${s.verdict === "pass" ? "✓" : "✗"} ${name}@${s.version} — ${s.verdict} (static fails: ${s.static_fails}, warns: ${s.static_warns}, smoke: ${s.smoke_passed === null ? "n/a" : s.smoke_passed ? `pass (${s.smoke_steps} steps)` : "FAIL"}) — ${s.checked_at}`);
    }
    return;
  }

  if (cmd === "badge") {
    if (!arg) usage();
    const idx = rebuildIndex(HARNESS_ROOT);
    const s = idx.skills[arg];
    if (!s) { console.error(`no results for skill ${arg}; run verify first`); process.exit(1); }
    writeBadge(HARNESS_ROOT, arg, { verdict: s.verdict, checkedAt: s.checked_at, warns: s.static_warns });
    console.log(`badge written: badges/${arg}.svg`);
    console.log(badgeMarkdown(arg));
    return;
  }

  if (!arg) usage();
  const skillDir = resolve(arg);
  if (!existsSync(join(skillDir, "SKILL.md"))) {
    console.error(`not a skill directory (no SKILL.md): ${skillDir}`);
    process.exit(1);
  }
  const skillName = basename(skillDir);
  const version = skillVersion(skillDir);

  if (cmd === "check" || cmd === "verify") {
    console.log(`== static checks: ${skillName}@${version} ==`);
    const checks = runStaticChecks(skillDir);
    fmtChecks(checks);
    const { fails, warns, verdict } = summarize(checks);
    console.log(`static: ${verdict.toUpperCase()} (${fails} fail, ${warns} warn)`);
    if (cmd === "check") process.exit(fails ? 1 : 0);
    var staticChecks = checks;
  }

  if (cmd === "smoke" || cmd === "verify") {
    console.log(`== smoke tests: ${skillName}@${version} ==`);
    const smoke = await runSmoke(skillDir, { skillName, harnessRoot: HARNESS_ROOT });
    for (const s of smoke.steps) {
      console.log(`  [${s.ok ? "✓" : s.warnOnly ? "~" : "✗"}] ${s.name}${s.detail ? `: ${s.detail}` : ""}`);
    }
    console.log(`smoke: ${smoke.passed ? "PASS" : "FAIL"} (${smoke.steps.filter(s => s.ok).length}/${smoke.steps.length} steps)`);
    if (cmd === "smoke") process.exit(smoke.passed ? 0 : 1);
    var smokeResult = smoke;
  }

  if (cmd === "verify") {
    const result = writeResult(HARNESS_ROOT, { skill: skillName, version, staticChecks, smoke: smokeResult });
    rebuildIndex(HARNESS_ROOT);
    writeBadge(HARNESS_ROOT, skillName, {
      verdict: result.verdict, checkedAt: result.checked_at, warns: result.static.warns,
    });
    console.log(`\nverdict: ${result.verdict.toUpperCase()}`);
    console.log(`result: results/${skillName}/${version}.json`);
    console.log(`badge:  badges/${skillName}.svg`);
    console.log(`embed:  ${badgeMarkdown(skillName)}`);
    process.exit(result.verdict === "pass" ? 0 : 1);
  }

  usage();
}

main().catch(e => { console.error(e); process.exit(1); });
