# guild-18 mutation testing — skill-harness

- date: 2026-10-08 (run by wave1000 guild-18, background unit batch 1)
- method: in-place perl-style edit per mutant, `node --test tests/harness.test.js` per mutant, byte-identical restore verified
- mutants run: 15, killed: 2, survived: 13

| id | file | mutation | result | notes |
|---|---|---|---|---|
| M1 | lib/frontmatter.mjs | off-by-one (dedent pop condition) | **SURVIVED** | Correct code pops while indent <= top (sibling at same level closes the nested map). Mutant keeps the nested map open for same-indent siblings. |
| M2 | lib/frontmatter.mjs | wrong operator (literal block scalar join) | **SURVIVED** | Literal '|' must preserve newlines; mutant folds them like '>'. |
| M3 | lib/frontmatter.mjs | wrong operator (comment strip) | **SURVIVED** | Mutant strips '#' anywhere (e.g. inside URLs), not just ' #' comments. |
| M4 | lib/results.mjs | off-by-one (verdict ignores one static fail) | **SURVIVED** | A skill with exactly 1 static fail would still get 'pass'. |
| M5 | lib/results.mjs | flipped condition (badge warn) | **KILLED** | Every passing badge would render the warn color/text. |
| M6 | lib/results.mjs | off-by-one (index tie-break) | **SURVIVED** | On equal mtimes, '>=' picks the last file in readdir order, '>' the first. Untested either way. |
| M7 | lib/static-checks.mjs | off-by-one (description max length) | **SURVIVED** | Exactly-1024-char description is spec-legal; mutant fails it. |
| M8 | lib/static-checks.mjs | flipped conditional (security severity) | **KILLED** | Fail-severity findings would only warn; warn-only would fail the skill. |
| M9 | lib/static-checks.mjs | wrong operator (name regex too lax) | **SURVIVED** | Mutant accepts leading/trailing/double hyphens, e.g. '-bad-'. |
| M10 | lib/static-checks.mjs | off-by-one (body line limit) | **SURVIVED** | Exactly-500-line body is spec-legal; mutant warns. |
| M11 | lib/smoke.mjs | dropped condition (warn-only becomes fatal) | **SURVIVED** | smoke.mjs has zero unit tests. Mutant flips any warn-only URL-liveness failure into a hard smoke FAIL. |
| M12 | lib/smoke.mjs | wrong operator (liveness threshold) | **SURVIVED** | 4xx responses (e.g. 403/404 on a live URL) would count as dead. Untested. |
| M13 | lib/smoke.mjs | dropped alternative (FAIL lines ignored) | **SURVIVED** | A walkthrough emitting PASS then FAIL would look all-pass. Untested. |
| M14 | bin/harness.mjs | flipped conditional (verify exit code) | **SURVIVED** | CLI exit codes untested: failing skills would exit 0 (CI-green lie). |
| M15 | bin/harness.mjs | flipped conditional (check exit code) | **SURVIVED** | CLI exit codes untested: inverted pass/fail signal to CI. |

## Survived-mutant classification

None of the survived mutants is a real defect in the shipped code — all are test gaps
(the mutant changes behavior on inputs the suite never exercises). Equivalent-on-corpus
mutants are marked as such; the rest get fail-first regression tests in tests/ on this branch.

- **M1**: test gap — dedent logic (`<=` vs `<`) has no same-indent-sibling case in the suite. Equivalent on current fixtures; real behavior change on `a:\n  x: 1\nb: 2`.
- **M2**: test gap — literal `|` block scalars untested. Regression test added: tests/mutant-reg.mjs asserts newline preservation.
- **M3**: test gap — comment stripping on values containing bare `#` (e.g. URL fragments) untested. Equivalent on current fixtures.
- **M4**: test gap — writeResult with exactly 1 static fail untested. Regression test added: 1 fail => verdict 'fail'.
- **M6**: equivalent on corpus — rebuildIndex tie-break between equal-mtime result files; suite uses a single file. Behavior differs only on ties.
- **M7**: test gap — exactly-1024-char description boundary untested. Regression test added: 1024 chars => pass.
- **M9**: test gap — name-format rejects `-bad-`/`bad--x` untested (suite only has Bad_Name_With_CAPS). Regression test added.
- **M10**: test gap — exactly-500-line body boundary untested. Equivalent-ish; warn-only so verdict-neutral.
- **M11**: test gap (notable) — smoke.mjs has ZERO unit tests; warn-only liveness failures flipping to fatal smoke FAIL is untested. Regression test added with a guaranteed-dead non-routable URL (warn-only step stays non-fatal).
- **M12**: test gap — 4xx liveness threshold untested (needs network stubbing; noted, not added).
- **M13**: test gap — walkthrough FAIL-line parsing untested (smoke.mjs has zero unit tests).
- **M14**: test gap — CLI exit codes untested (bin/harness.mjs has zero tests). `verify` on a failing skill exiting 0 would be a CI-green lie. Regression test added via child process.
- **M15**: test gap — CLI exit codes untested; `check` inversion untested. Covered by the same CLI regression test.

## Killed mutants

- **M5** (results.mjs badge warn flip): killed by "badge: svg reflects verdict and date" — pass+0 warns must render "verified working".
- **M8** (static-checks.mjs severity flip): killed by "static: sneaky fixture fails security scan" — fail-severity findings must fail the skill.

## Verdict

Mutation score on the unit suite: 2/15 killed. The 2 killed mutants are both caught by existing tests.
All 13 survived mutants are test gaps or corpus-equivalences — no real shipped-code defect found by mutation.
Regression tests for M2/M4/M7/M9/M11/M14/M15 land in tests/mutant-reg-*.test.js on branch wave1000/guild-18 (fail-first: verified to fail with the mutant applied, pass on clean tree).
