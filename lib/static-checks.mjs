// Static checks for Agent Skills, derived from the Agent Skills specification
// (https://agentskills.io/specification, fetched 2026-09-23).
//
// Each check: { id, status: 'pass'|'warn'|'fail', detail }.
// Verdict rule: any 'fail' => skill fails. 'warn' never fails, but is reported.

import { readFileSync, existsSync } from "node:fs";
import { basename, join, dirname, resolve } from "node:path";
import { parseFrontmatter } from "./frontmatter.mjs";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KNOWN_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

// Instruction-smuggling / prompt-injection patterns aimed at the installing agent.
// Kept deliberately tight to avoid false positives; each entry: [id, regex, severity, note].
const INJECTION_PATTERNS = [
  ["ignore-previous-instructions", /\bignore\s+(all\s+|any\s+)?(previous|prior)\s+instructions\b/i, "fail",
    "Attempts to override the installing agent's instructions."],
  ["disregard-instructions", /\bdisregard\s+(all\s+)?(prior|previous)\s+instructions\b/i, "fail",
    "Attempts to override the installing agent's instructions."],
  ["override-instructions", /\boverride\s+your\s+(system\s+)?instructions\b/i, "fail",
    "Attempts to override the installing agent's instructions."],
  ["jailbreak-persona", /\byou\s+are\s+now\s+(?!.*\bassistant\b)/i, "warn",
    "Persona-reassignment phrasing ('you are now …'). Verify it is benign."],
  ["reveal-system-prompt", /\b(reveal|disclose|print|output)\s+(your\s+)?(system\s+prompt|initial\s+instructions)\b/i, "fail",
    "Attempts to exfiltrate the installing agent's system prompt."],
];

// Credential-harvesting / exfiltration patterns.
const EXFIL_PATTERNS = [
  ["paste-api-key", /\b(paste|enter|provide|send)\s+(your\s+)?(api[_\s-]?key|secret\s+key|private\s+key|password|auth\s+token)\b/i, "warn",
    "Asks the agent/user for a raw credential. Prefer documented secret-manager flows."],
  ["env-to-network", /\b(process\.env|os\.environ|getenv)\b[\s\S]{0,120}?\b(fetch|axios|requests\.post|urllib|curl)\b/i, "fail",
    "Reads environment secrets and sends them over the network."],
  ["secret-in-url", /\b(api[_-]?key|token|secret|password)\s*=\s*["']?https?:\/\//i, "fail",
    "Embeds a credential-looking value in a URL."],
  ["pipe-to-shell", /\b(curl|wget)\b[^`\n]{0,200}\|\s*(ba)?sh\b/i, "warn",
    "Pipes a remote download straight into a shell. Pin versions/hashes or vendor the script."],
];

const USE_WHEN_RE = /\b(used?\s+when|when\s+to\s+use|when\s+you\s+(need|want|have|hold|get|receive))\b/i;

function check(id, status, detail) {
  return { id, status, detail };
}

export function runStaticChecks(skillDir) {
  const out = [];
  const dirName = basename(resolve(skillDir));
  const skillMd = join(skillDir, "SKILL.md");

  if (!existsSync(skillMd)) {
    return [check("skill-md-exists", "fail", "SKILL.md not found at skill root.")];
  }
  out.push(check("skill-md-exists", "pass", "SKILL.md present."));

  const text = readFileSync(skillMd, "utf8");
  const fm = parseFrontmatter(text);
  if (!fm.ok) {
    out.push(check("frontmatter-parse", "fail", fm.error));
    return out;
  }
  out.push(check("frontmatter-parse", "pass", "Frontmatter parses."));
  const data = fm.data;
  const body = fm.body;

  // --- name ---
  if (typeof data.name !== "string" || !data.name) {
    out.push(check("name-present", "fail", "Required field `name` is missing or empty."));
  } else {
    out.push(check("name-present", "pass", `name: ${data.name}`));
    const n = data.name;
    const nameOk = n.length >= 1 && n.length <= 64 && NAME_RE.test(n);
    out.push(check("name-format", nameOk ? "pass" : "fail",
      nameOk ? "1–64 chars, lowercase alnum + hyphens, no leading/trailing/double hyphens."
             : `Invalid name ${JSON.stringify(n)}: must be 1–64 chars, lowercase letters/numbers/hyphens only, no leading/trailing hyphen, no consecutive hyphens.`));
    out.push(check("name-matches-dir", n === dirName ? "pass" : "fail",
      n === dirName ? `Matches directory name "${dirName}".`
                    : `name ${JSON.stringify(n)} does not match directory name ${JSON.stringify(dirName)} (spec requires a match).`));
  }

  // --- description ---
  if (typeof data.description !== "string" || !data.description) {
    out.push(check("description-present", "fail", "Required field `description` is missing or empty."));
  } else {
    out.push(check("description-present", "pass", `${data.description.length} chars.`));
    const d = data.description;
    out.push(check("description-length", d.length >= 1 && d.length <= 1024 ? "pass" : "fail",
      d.length >= 1 && d.length <= 1024 ? "Within the 1–1024 char spec range."
        : `Length ${d.length} is outside the 1–1024 char spec range.`));
    const hasWhen = USE_WHEN_RE.test(d);
    const longEnough = d.length >= 40;
    out.push(check("description-quality", hasWhen && longEnough ? "pass" : "warn",
      hasWhen && longEnough
        ? "Describes what the skill does and when to use it."
        : "Should describe both what the skill does AND when to use it (add a 'use when…' cue); aim for a substantive, keyword-rich description — this is what agents match on."));
  }

  // --- optional fields ---
  const unknown = Object.keys(data).filter(k => !KNOWN_FIELDS.has(k));
  for (const k of unknown) {
    out.push(check(`field-${k}`, "warn", `Unknown frontmatter field ${JSON.stringify(k)} (spec defines: ${[...KNOWN_FIELDS].join(", ")}).`));
  }
  if (data.compatibility !== undefined) {
    const c = String(data.compatibility);
    out.push(check("compatibility-length", c.length >= 1 && c.length <= 500 ? "pass" : "warn",
      c.length >= 1 && c.length <= 500 ? "Within 1–500 chars." : `Length ${c.length} outside the 1–500 char spec range.`));
  }
  if (data.metadata !== undefined) {
    const md = data.metadata;
    const mdOk = md && typeof md === "object" && !Array.isArray(md) &&
      Object.entries(md).every(([k, v]) => typeof k === "string" && typeof v === "string");
    out.push(check("metadata-shape", mdOk ? "pass" : "warn",
      mdOk ? "String→string map." : "`metadata` should be a map of string keys to string values."));
  }
  if (data["allowed-tools"] !== undefined && typeof data["allowed-tools"] !== "string") {
    out.push(check("allowed-tools-shape", "warn", "`allowed-tools` should be a space-separated string."));
  }

  // --- body ---
  if (!body.trim()) {
    out.push(check("body-nonempty", "fail", "No Markdown body after the frontmatter."));
  } else {
    out.push(check("body-nonempty", "pass", `${body.trim().split(/\r?\n/).length} lines of instructions.`));
    const lines = body.split(/\r?\n/).length;
    out.push(check("body-length", lines <= 500 ? "pass" : "warn",
      lines <= 500 ? `${lines} lines (spec recommends < 500).`
                   : `${lines} lines exceeds the spec's < 500 line recommendation — move detail to references/.`));
    const hasStructure = /^#{1,3}\s+\S/m.test(body) || /^\s*\d+[.)]\s+\S/m.test(body);
    out.push(check("body-structure", hasStructure ? "pass" : "warn",
      hasStructure ? "Has headings and/or numbered steps."
                   : "No headings or numbered steps found — step-by-step instructions are recommended."));
  }

  // --- file references resolve ---
  const refPaths = new Set();
  for (const m of body.matchAll(/`((?:scripts|references|assets)\/[A-Za-z0-9_./-]+)`/g)) refPaths.add(m[1]);
  for (const m of body.matchAll(/\[[^\]]*\]\(\./g)) {
    const mm = body.slice(m.index).match(/^\[[^\]]*\]\((\.[^)]+)\)/);
    if (mm) refPaths.add(mm[1].replace(/^\.\//, ""));
  }
  const missing = [...refPaths].filter(p => !existsSync(join(skillDir, p)));
  out.push(check("file-references-resolve", missing.length === 0 ? "pass" : "warn",
    missing.length === 0 ? `${refPaths.size} referenced file(s), all resolve.`
                         : `Missing referenced file(s): ${missing.join(", ")}`));

  // --- security scan ---
  const findings = [];
  for (const [id, re, sev, note] of [...INJECTION_PATTERNS, ...EXFIL_PATTERNS]) {
    const m = text.match(re);
    if (m) {
      const at = text.slice(0, m.index).split("\n").length;
      findings.push({ id, severity: sev, line: at, note, excerpt: m[0].slice(0, 80) });
    }
  }
  if (findings.length === 0) {
    out.push(check("security-scan", "pass", "No instruction-smuggling or exfiltration patterns matched."));
  } else {
    const fails = findings.filter(f => f.severity === "fail");
    out.push(check("security-scan", fails.length ? "fail" : "warn",
      `${findings.length} finding(s): ` + findings.map(f => `[${f.severity}] ${f.id} (line ~${f.line}): ${f.note}`).join(" ")));
  }

  return out;
}

export function summarize(checks) {
  const fails = checks.filter(c => c.status === "fail").length;
  const warns = checks.filter(c => c.status === "warn").length;
  return { fails, warns, verdict: fails === 0 ? "pass" : "fail" };
}
