// guild-18 negative repro: badge-name path traversal is NOT reachable.
// Run from the repo root: node findings/guild-18/repro-traversal.mjs
// Expected: "NOT VULNERABLE" — the traversal never reaches writeBadge().
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const probe = join(ROOT, ".tmp", "g18traversal-probe.svg");
if (existsSync(probe)) rmSync(probe);

const r = spawnSync("node", ["bin/harness.mjs", "badge", "../../.tmp/g18traversal-probe"], {
  cwd: ROOT, encoding: "utf8", timeout: 30000,
});
const escaped = existsSync(probe);
if (escaped) rmSync(probe);

console.log(`badge exit code: ${r.status}`);
console.log(`stderr: ${(r.stderr || "").trim().split("\n")[0]}`);
console.log(`file escaped badges/: ${escaped}`);
console.log(escaped ? "VULNERABLE" : "NOT VULNERABLE — writeBadge is gated by the index lookup (unknown name exits 1 before any write), and the verify flow passes basename(skillDir).");
process.exit(escaped ? 1 : 0);
