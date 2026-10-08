import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recordVerifyTrace } from "../lib/trace.mjs";
import { scrubSecrets, SCRUB_PATTERNS } from "../lib/scrub.mjs";

const checks = [
  { id: "skill-md-exists", status: "pass", detail: "SKILL.md present." },
  { id: "frontmatter-parse", status: "fail", detail: "missing required field: name" },
];
const smoke = {
  steps: [
    { name: "script-syntax: index.mjs", ok: true, detail: "parses" },
    { name: "url-liveness: https://example.com", ok: false, warnOnly: true, detail: "HEAD 503" },
    { name: "walkthrough: hello world", ok: false, warnOnly: false, detail: "no output" },
  ],
  passed: false,
};

function record(root, overrides = {}) {
  return recordVerifyTrace({
    harnessRoot: root,
    skill: "demo-skill",
    version: "1.0.0",
    seed: "42",
    harnessCommit: "abc123",
    checks,
    smoke,
    ...overrides,
  });
}

function readLines(path) {
  return readFileSync(path, "utf8").trim().split("\n").map(l => JSON.parse(l));
}

describe("recordVerifyTrace", () => {
  it("(a) writes valid JSONL: every line parses, header/step/footer sequence, seq 1..N", () => {
    const root = mkdtempSync(join(tmpdir(), "harness-"));
    const outPath = record(root);
    assert.ok(existsSync(outPath));
    const lines = readLines(outPath);
    // every line parsed (readLines throws on invalid JSON)
    assert.equal(lines[0].type, "header");
    assert.equal(lines[0].v, 1);
    assert.equal(lines[0].skill, "demo-skill");
    assert.equal(lines[0].version, "1.0.0");
    assert.equal(lines[0].seed, "42");
    assert.equal(lines[0].harness, "abc123");
    assert.equal(lines.at(-1).type, "footer");
    assert.equal(lines.at(-1).v, 1);
    const steps = lines.slice(1, -1);
    assert.ok(steps.length > 0);
    assert.ok(steps.every(s => s.type === "step" && s.v === 1));
    assert.deepEqual(steps.map(s => s.seq), steps.map((_, i) => i + 1));
    assert.equal(lines.at(-1).steps, steps.length);
    assert.equal(lines.at(-1).status, "fail"); // one check fails
    assert.ok(typeof lines[0].startedAt === "string");
    assert.ok(typeof lines.at(-1).endedAt === "string");
  });

  it("(b) scrubs secrets embedded in detail text", () => {
    const secretDetail =
      "token sk-abcdefghijklmnopqrstuvwxyz0123456789 and ghp_abcdefghij0123456789klmn " +
      "with Authorization: Bearer abcdef123456789";
    const root = mkdtempSync(join(tmpdir(), "harness-"));
    const outPath = record(root, {
      checks: [{ id: "leak", status: "pass", detail: secretDetail }],
      smoke: { steps: [], passed: true },
    });
    const lines = readLines(outPath);
    const step = lines.find(l => l.type === "step" && l.name === "leak");
    assert.ok(!step.detail.includes("sk-abcdefghijklmnopqrstuvwxyz"), "sk- key leaked");
    assert.ok(!step.detail.includes("ghp_abcdefghij"), "ghp_ token leaked");
    assert.ok(!step.detail.includes("Bearer abcdef"), "Bearer token leaked");
    assert.ok(step.detail.includes("[REDACTED]"));
  });

  it("(c) url:-named smoke steps get mocked:true, others false", () => {
    const root = mkdtempSync(join(tmpdir(), "harness-"));
    const outPath = record(root);
    const steps = readLines(outPath).filter(l => l.type === "step");
    const url = steps.find(s => s.name.startsWith("url"));
    const script = steps.find(s => s.name.startsWith("script-syntax"));
    const walk = steps.find(s => s.name.startsWith("walkthrough"));
    assert.equal(url.mocked, true);
    assert.equal(script.mocked, false);
    assert.equal(walk.mocked, false);
  });

  it("(d) status mapping from (ok, warnOnly)", () => {
    const root = mkdtempSync(join(tmpdir(), "harness-"));
    const outPath = record(root, {
      checks: [],
      smoke: {
        steps: [
          { name: "s-pass", ok: true, warnOnly: false, detail: "" },
          { name: "s-fail", ok: false, warnOnly: false, detail: "" },
          { name: "s-warn", ok: false, warnOnly: true, detail: "" },
          { name: "s-pass-warnflag", ok: true, warnOnly: true, detail: "" },
        ],
        passed: false,
      },
    });
    const byName = Object.fromEntries(
      readLines(outPath).filter(l => l.type === "step").map(s => [s.name, s.status])
    );
    assert.equal(byName["s-pass"], "pass");
    assert.equal(byName["s-fail"], "fail");
    assert.equal(byName["s-warn"], "warn");
    assert.equal(byName["s-pass-warnflag"], "pass");
  });

  it("(e) default outPath lands under <harnessRoot>/traces/", () => {
    const root = mkdtempSync(join(tmpdir(), "harness-"));
    const outPath = record(root);
    assert.ok(outPath.startsWith(join(root, "traces") + "/"), outPath);
    assert.match(outPath, /\d{8}T\d{6}Z\.trace\.jsonl$/);
    assert.ok(existsSync(outPath));
    assert.ok(readdirSync(join(root, "traces")).length >= 1);
  });
});

describe("scrubSecrets", () => {
  it("redacts a fake sk- key", () => {
    const out = scrubSecrets("key is sk-abcdefghijklmnopqrstuvwxyz0123456789 done");
    assert.ok(!out.includes("sk-abcdefghijklmnopqrstuvwxyz"));
    assert.ok(out.includes("[REDACTED]"));
  });

  it("redacts a fake ghp_ token", () => {
    const out = scrubSecrets("token ghp_abcdefghij0123456789klmnopqrst done");
    assert.ok(!out.includes("ghp_abcdefghij"));
    assert.ok(out.includes("[REDACTED]"));
  });

  it("redacts a Bearer token", () => {
    const out = scrubSecrets("header Authorization: Bearer abcdef123456789 here");
    assert.ok(!out.includes("abcdef123456789"));
    assert.ok(out.includes("[REDACTED]"));
  });

  it("redacts slack, AWS, and api_key forms", () => {
    const t = "xoxb-1234-abcdef api_key=secretvalue12345 AKIAABCDEFGHIJKLMNOP";
    const out = scrubSecrets(t);
    assert.ok(!out.includes("xoxb-1234"));
    assert.ok(!out.includes("secretvalue12345"));
    assert.ok(!out.includes("AKIAABCDEFGHIJKLMNOP"));
  });

  it("passes non-string input through as-is", () => {
    assert.equal(scrubSecrets(null), null);
    assert.equal(scrubSecrets(undefined), undefined);
    assert.equal(scrubSecrets(42), 42);
  });

  it("exposes SCRUB_PATTERNS as regexes", () => {
    assert.ok(Array.isArray(SCRUB_PATTERNS) && SCRUB_PATTERNS.length > 0);
    assert.ok(SCRUB_PATTERNS.every(p => p instanceof RegExp));
  });
});
