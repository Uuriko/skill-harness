// Harness self-tests. Run: npm test  (node --test tests/)
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const { parseFrontmatter } = await import(join(ROOT, "lib/frontmatter.mjs"));
const { runStaticChecks, summarize } = await import(join(ROOT, "lib/static-checks.mjs"));
const { badgeSvg, writeResult, rebuildIndex } = await import(join(ROOT, "lib/results.mjs"));

const fixture = n => join(HERE, "fixtures", n);

test("frontmatter: parses name/description/metadata map", () => {
  const r = parseFrontmatter("---\nname: x\nmetadata:\n  a: b\n---\nbody\n");
  assert.equal(r.ok, true);
  assert.equal(r.data.name, "x");
  assert.deepEqual(r.data.metadata, { a: "b" });
  assert.equal(r.body.trim(), "body");
});

test("frontmatter: rejects missing delimiters", () => {
  assert.equal(parseFrontmatter("no frontmatter here").ok, false);
});

test("frontmatter: quoted description with colon", () => {
  const r = parseFrontmatter('---\ndescription: "does x: and y"\n---\n');
  assert.equal(r.ok, true);
  assert.equal(r.data.description, "does x: and y");
});

test("static: good fixture passes", () => {
  const checks = runStaticChecks(fixture("good-skill"));
  const { fails, verdict } = summarize(checks);
  assert.equal(fails, 0, JSON.stringify(checks.filter(c => c.status !== "pass"), null, 2));
  assert.equal(verdict, "pass");
});

test("static: sneaky fixture fails security scan", () => {
  const checks = runStaticChecks(fixture("sneaky-skill"));
  const sec = checks.find(c => c.id === "security-scan");
  assert.equal(sec.status, "fail");
  assert.match(sec.detail, /ignore-previous-instructions/);
  assert.match(sec.detail, /reveal-system-prompt/);
  assert.equal(summarize(checks).verdict, "fail");
});

test("static: sloppy fixture fails name, warns on the rest", () => {
  const checks = runStaticChecks(fixture("sloppy-skill"));
  const byId = Object.fromEntries(checks.map(c => [c.id, c]));
  assert.equal(byId["name-format"].status, "fail");
  assert.equal(byId["name-matches-dir"].status, "fail"); // dir is sloppy-skill
  assert.equal(byId["field-bogus-field"].status, "warn");
  assert.equal(byId["body-structure"].status, "warn");
  assert.equal(byId["file-references-resolve"].status, "warn");
  assert.equal(summarize(checks).verdict, "fail");
});

test("static: missing SKILL.md fails fast", () => {
  const d = mkdtempSync(join(tmpdir(), "harness-test-"));
  const checks = runStaticChecks(d);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, "fail");
});

test("badge: svg reflects verdict and date", () => {
  const svg = badgeSvg({ verdict: "pass", checkedAt: "2026-09-23T00:00:00.000Z", warns: 0 });
  assert.match(svg, /verified working/);
  assert.match(svg, /2026-09-23/);
  assert.match(svg, /^<svg /);
  const fail = badgeSvg({ verdict: "fail", checkedAt: "2026-09-23T00:00:00.000Z" });
  assert.match(fail, /checks failing/);
  const warn = badgeSvg({ verdict: "pass", checkedAt: "2026-09-23T00:00:00.000Z", warns: 2 });
  assert.match(warn, /2 warnings/);
});

test("results: writeResult + rebuildIndex round-trip", () => {
  const root = mkdtempSync(join(tmpdir(), "harness-results-"));
  mkdirSync(join(root, "results"), { recursive: true });
  const r = writeResult(root, {
    skill: "demo-skill", version: "abc123",
    staticChecks: [{ id: "name-format", status: "pass", detail: "ok" }],
    smoke: { passed: true, steps: [{ name: "s", ok: true, detail: "d" }] },
  });
  assert.equal(r.verdict, "pass");
  const idx = rebuildIndex(root);
  assert.equal(idx.skills["demo-skill"].verdict, "pass");
  assert.equal(idx.skills["demo-skill"].version, "abc123");
});
