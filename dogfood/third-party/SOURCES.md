# Dogfood sources

Third-party skills tested by the harness, fetched read-only 2026-09-23 for
independent verification. Not modified. Upstream: https://github.com/anthropics/skills
(Apache-2.0 for most skills; some reference skills are source-available — see upstream).

- `theme-factory/` — upstream `skills/theme-factory/SKILL.md`
- `webapp-testing/` — upstream `skills/webapp-testing/SKILL.md`
- `skill-creator/` — upstream `skills/skill-creator/SKILL.md`

Static checks run against the fetched files as-is. No smoke walkthroughs are
run against third-party skills (no live-service installs without consent);
smoke for these = bundled-script syntax + referenced-URL liveness only.
