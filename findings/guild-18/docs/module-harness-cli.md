# bin/harness.mjs — CLI doc

**Purpose.** The `skill-harness` CLI (`"bin": { "skill-harness": "bin/harness.mjs" }`).
Six commands; `HARNESS_ROOT` is derived from the script's own path
(`dirname(dirname(fileURLToPath(import.meta.url)))`) — results/badges/traces
always land relative to the *installed* harness, not the cwd.

## Commands

| command | does | exit code |
|---|---|---|
| `check <skill-dir>` | static checks only | `fails ? 1 : 0` |
| `smoke <skill-dir>` | smoke tests only | `passed ? 0 : 1` |
| `verify <skill-dir>` | static + smoke, then `writeResult` + `rebuildIndex` + `writeBadge` | `verdict === "pass" ? 0 : 1` |
| `badge <skill-name>` | `rebuildIndex`, then regenerate `badges/<name>.svg` from the index entry | 1 if no results for the name |
| `index` | `rebuildIndex` only | 0 |
| `list` | `rebuildIndex`, then one line per skill: verdict, version, static fail/warn counts, smoke summary, `checked_at` | 0 |

No command → usage text, exit 2. `check`/`smoke`/`verify` require `<skill-dir>`
to contain `SKILL.md` (else `not a skill directory`, exit 1). `badge` requires
an arg (else usage, exit 2).

## `verify` flow (the money path)
1. `skillVersion(skillDir)` → version string.
2. `runStaticChecks` → printed with ✓/!/✗ icons; `check` stops here.
3. `runSmoke(skillDir, { skillName, harnessRoot })` → per-step ✓/~/✗ lines;
   `smoke` stops here.
4. `writeResult` → `results/<skill>/<version>.json`.
5. `rebuildIndex` → `results/index.json`.
6. `writeBadge` → `badges/<skill>.svg`; prints the embed markdown.
7. Exit `verdict === "pass" ? 0 : 1`.

## Gotchas
- **CLI exit codes are untested** (mutations M14/M15 survived: flipping either
  exit expression changes nothing the suite can see). A flipped `verify` exit
  would be a CI-green lie — regression coverage added on this branch via a
  child-process test.
- `badge <name>` resolves `<name>` against the rebuilt index; unknown names
  exit 1 *before* any file write (this is what makes the F8 traversal
  unreachable).
- `list` output for a skill with no smoke run shows `smoke: n/a`.
- Errors thrown anywhere in `main()` are caught once: `console.error(e);
  process.exit(1)` — stack traces *can* reach stderr on unexpected throws
  (fuzz F13 confirmed the dangling-symlink path exits 1, but via this generic
  catch, not a friendly message — `readFileSync` throws ENOENT inside
  `runStaticChecks`, which does not catch it).
- `usage()` exits 2, distinct from the 0/1 check/smoke/verify contract.
