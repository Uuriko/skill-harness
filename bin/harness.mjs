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
import { recordVerifyTrace } from "../lib/trace.mjs";
import { replayTrace } from "../lib/replay.mjs";
import { execFileSync } from "node:child_process";

const HARNESS_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function usage() {
  console.log(`skill-harness — independent verified-working tester for Agent Skills

usage:
  harness.mjs check <skill-dir>   static checks only
  harness.mjs smoke <skill-dir>   smoke tests only
  harness.mjs verify <skill-dir> [--record [out]] [--replay <trace>]
                                  full run + results + badge;
                                  --record writes a replay trace of this run;
                                  --replay <trace> gates promotion: any step that
                                  passed in the trace but fails now blocks the badge
  harness.mjs replay <trace> --skill <dir>
                                  re-execute a recorded trace, report divergence
  harness.mjs badge <skill-name>  regenerate badge from latest result
  harness.mjs index               rebuild results/index.json
  harness.mjs list                list latest results`);
  process.exit(2);
}

function harnessCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: HARNESS_ROOT, encoding: "utf8" }).trim();
  } catch { return "unknown"; }
}

function fmtChecks(checks) {
  const icon = { pass: "✓", warn: "!", fail: "✗" };
  for (const c of checks) console.log(`  [${icon[c.status]}] ${c.id}: ${c.detail}`);
}

async function main() {
  // Minimal flag parsing (backward compatible: no flags = old behavior).
  const rawArgs = process.argv.slice(2);
  const flags = {};
  const positionals = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === "--record") {
      flags.record = (rawArgs[i + 1] && !rawArgs[i + 1].startsWith("--")) ? rawArgs[++i] : true;
    } else if (a === "--replay" && rawArgs[i + 1]) {
      flags.replay = rawArgs[++i];
    } else if (a === "--skill" && rawArgs[i + 1]) {
      flags.skill = rawArgs[++i];
    } else {
      positionals.push(a);
    }
  }
  const [cmd, arg] = positionals;
  if (!cmd) usage();

  if (cmd === "replay") {
    if (!arg || !flags.skill) {
      console.error("usage: harness.mjs replay <trace> --skill <dir>");
      process.exit(2);
    }
    const skillDir = resolve(flags.skill);
    const rep = await replayTrace(resolve(arg), { skillDir, harnessRoot: HARNESS_ROOT });
    console.log(`replay: ${rep.recorded.skill}@${rep.recorded.version} — ${rep.steps} steps compared, ${rep.mocked} mocked`);
    if (rep.divergences.length === 0) {
      console.log("replay: CLEAN — no divergences");
    } else {
      for (const d of rep.divergences) {
        console.log(`  [${d.kind}] ${d.name}: expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.actual)}`);
      }
    }
    process.exit(rep.clean ? 0 : 1);
  }

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

  // Recording seed: fixed before smoke runs so walkthroughs inherit it via env.
  let recordSeed = null;
  if (cmd === "verify" && flags.record) {
    recordSeed = process.env.HARNESS_SEED ? parseInt(process.env.HARNESS_SEED, 10) : Math.floor(Math.random() * 2 ** 31);
    process.env.HARNESS_SEED = String(recordSeed);
  }

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
    // Promotion gate: replay the reference trace against the CURRENT skill dir.
    // Any step that passed in the trace but fails now = regression → no promotion.
    if (flags.replay) {
      const rep = await replayTrace(resolve(flags.replay), { skillDir, harnessRoot: HARNESS_ROOT });
      const regressions = rep.divergences.filter(d => d.kind === "status" || d.kind === "missing");
      if (regressions.length > 0) {
        console.error(`\nreplay gate FAILED vs ${flags.replay}: ${regressions.length} regression(s)`);
        for (const d of regressions) {
          console.error(`  [${d.kind}] ${d.name}: recorded ${JSON.stringify(d.expected)}, now ${JSON.stringify(d.actual)}`);
        }
        console.error("badge not regenerated; change not promoted.");
        process.exit(1);
      }
      console.log(`\nreplay gate: CLEAN (${rep.steps} steps, ${rep.mocked} mocked) vs ${flags.replay}`);
    }

    if (flags.record) {
      const tracePath = recordVerifyTrace({
        harnessRoot: HARNESS_ROOT,
        skill: skillName,
        version,
        seed: recordSeed,
        harnessCommit: harnessCommit(),
        checks: staticChecks,
        smoke: smokeResult,
        outPath: flags.record === true ? undefined : resolve(flags.record),
      });
      console.log(`trace recorded: ${tracePath}`);
    }

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
