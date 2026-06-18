# Changelog

All notable changes to the Agentic SDD skeleton. The setup wizard surfaces these
notes in the "Update available" banner so developers see what re-running setup brings.

**Format:** one `## <version> — <date>` heading per release, followed by `-` bullets.
The generator (`engine/generate-embedded.js`) parses only the numbered version
headings — the "Unreleased" section below is ignored until you promote it to a version.

## 1.4 — 2026-06-18

- **Surgical update mechanism**: the wizard now hash-checks CLAUDE.md, hooks, and templates
  before overwriting — files you've modified are detected and never silently overwritten.
- **Section markers in CLAUDE.md**: `<!-- sdd:framework:start/end -->` and
  `<!-- sdd:custom:start/end -->` protect your project-specific rules during updates —
  the wizard merges the new framework section while preserving your custom zone.
- **`.sdd-manifest.json`** replaces `.sdd-version` — stores per-file content hashes so
  the wizard knows exactly which files are safe to overwrite on the next update.
- **Conflict UI**: when a modified file is detected, the wizard shows the new version with
  Skip / Overwrite controls — your decision, never a silent overwrite.
- **PR classification in Android PR review**: the review skill now detects PR type
  (Feature / Bug Fix / Refactor / Task / Hotfix) from branch name and commit keywords
  before reviewing, making severity judgements type-aware.

**Update instructions for existing projects:**
1. Pull the submodule: `git submodule update --remote agent-sdd`
2. Open `agent-sdd/setup-wizard.html`, select your project folder — click "Update now".
   The wizard will hash-check each file and show a conflict dialog for any you've modified.
3. For hook fixes: re-copy scripts you haven't customized: `cp agent-sdd/hooks/scripts/*.sh .claude/hooks/scripts/`

## 1.3 — 2026-06-13

- **ARCHITECTURE.md round-trip**: re-opening the wizard on an existing project reads your
  previous architectural choices (arch pattern, DI, UI, nav) back from `spec-kit/ARCHITECTURE.md`
  so human corrections survive wizard re-runs without starting from scratch.
- **CI drift check**: the wizard scans `.github/workflows/`, `fastlane/Fastfile`, and
  `bitrise.yml` / `ci_scripts/` and surfaces mismatches between CI config and what CONVENTIONS.md
  will say (JDK/Xcode version, ktlint/SwiftLint gate, coverage enforcement). Shown as an amber
  banner at the top of the Conventions step.
- **Auto-detected markers**: wizard-generated ARCHITECTURE.md now annotates every value that
  was defaulted (not actually detected in the codebase) with a blockquote warning so teams know
  which decisions need verification before committing.
- **Deeper source walk**: `countSourceFiles` depth raised from 4 → 8, fixing undercount of
  Kotlin/Java files in deeply nested multi-module projects.
- **Multi-module includes**: `include ':app', ':core', ':feature-home'` in `settings.gradle`
  now correctly captures all modules, not just the first argument.
- **Hook language corrected**: CLAUDE.md no longer claims hooks are "deterministic" — they
  cover common enforcement cases but are not a complete sandbox.
- **Hook bugs fixed**: `lint-gate.sh` — three bugs patched (shell variable expansion, SwiftLint
  CLI flag removed in 0.52+, `find -o` precedence). `git-guard.sh` — compound command handling.
  `protected-paths.sh` — write-to-protected-path detection added.

**Update instructions for existing projects:**
1. Pull the submodule: `git submodule update --remote agent-sdd`
2. Open `agent-sdd/setup-wizard.html`, select your project folder — wizard pre-fills from
   your existing `spec-kit/ARCHITECTURE.md` (round-trip). Review, then re-save CLAUDE.md
   (final step) to get the new snapshot.
3. For hook fixes: `diff .claude/hooks/scripts/ agent-sdd/hooks/scripts/` and copy scripts
   you haven't customized: `cp agent-sdd/hooks/scripts/*.sh .claude/hooks/scripts/`

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
