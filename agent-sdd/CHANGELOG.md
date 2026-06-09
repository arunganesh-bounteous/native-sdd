# Changelog

All notable changes to the Agentic SDD skeleton. The setup wizard surfaces these
notes in the "Update available" banner so developers see what re-running setup brings.

**Format:** one `## <version> — <date>` heading per release, followed by `-` bullets.
The generator (`engine/generate-embedded.js`) parses only the numbered version
headings — the "Unreleased" section below is ignored until you promote it to a version.

## Unreleased (next version)

- Plug-n-play skills: optional per-ticket instruction modules in `agent-artifacts/skills/`,
  activated via a `Skills:` line in the task file. Ships `ada` (accessibility/a11y compliance)
  and `analytics` (event instrumentation). Off by default; a skill only adds requirements,
  never relaxes the base quality gate or a Hard Rule.

## 1.2 — 2026-06-08
- Context freshness check: the agent verifies a context file's Key Files still exist
  before trusting it, and re-derives from source if any are missing.
- Keywords are no longer duplicated in `MODULE_MAP.md` — `context/_index.md` is the
  single routing source of truth, eliminating spec-to-spec drift.
- Closed the verification loop: the agent now builds/compiles and runs tests in Step 6
  and must report real outcomes — code it cannot build or test can no longer report PASS.
- Warn-only security scan: the agent flags hardcoded secrets (file:line) and surfaces them
  in the completion report, but never fixes, redacts, or moves them — remediation stays human.
- Branch ownership made explicit: the agent assumes the correct branch is checked out and
  stops if it lands on main/master/develop.
- CLAUDE.md viewer readability: stylesheet now applies, numbered lists and bare comment
  dividers render correctly, and the maintainer header is hidden in the preview.

## 1.1 — 2026-06-07

- Version manifest (`agent-artifacts/.sdd-version`) and a wizard "Update available"
  banner so projects know when their snapshot is behind the skeleton.
- Single source of truth: clean source files are embedded into the wizard by
  `engine/generate-embedded.js` (no drift between source and the shipped copies).
- Git safety: `git-guard.sh` hook plus git deny rules, and absolute-path
  normalization in the hook scripts.
