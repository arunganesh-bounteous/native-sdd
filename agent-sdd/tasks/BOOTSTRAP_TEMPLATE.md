# Task: BOOTSTRAP — Generate context file for [Module Name]

## Type

- [ ] Bug
- [ ] Feature
- [ ] Refactor
- [x] Chore

## Description

**This is a context discovery run — no code changes.**

On day 1 of adopting the Agentic SDD system, context files do not exist yet.
Without them, the agent falls back to scanning source files on every task, which
is slower and more error-prone.

Run this task once per module to generate its `context/<module>.md` file.
The agent reads the source files, extracts structure, and writes the context file.
No production code is created or modified.

Replace `[Module Name]` and the file paths below with the actual module details
from `spec-kit/MODULE_MAP.md` before running.

## Acceptance Criteria

- [ ] `context/<module>.md` exists and follows the structure in `context/TEMPLATE.md`
- [ ] Key Files table is populated with actual file paths (relative to `codebase_path`)
- [ ] State Management section describes what the ViewModel exposes (or notes "N/A" if no ViewModel)
- [ ] Dependencies section lists what this module imports and what imports it
- [ ] "What the Agent Should Know" section contains at least one non-obvious fact, or notes "None found"
- [ ] Known Debt section lists any OPEN patterns found during the scan, or notes "None found"
- [ ] Tests section lists existing test files, or notes "No tests found"
- [ ] A routing row for this module is added to `context/_index.md`

## Quality Gate

- [ ] No production source files were created or modified
- [ ] No `spec-kit/` files were modified (read-only)
- [ ] Context file uses the exact section structure from `context/TEMPLATE.md`
- [ ] All file paths in Key Files table are verified to exist

## Out of Scope

- Do NOT fix any code issues discovered during the scan — log them in the completion report
- Do NOT create unit tests — this is a read-only discovery run
- Do NOT modify `spec-kit/MODULE_MAP.md` — add routing to `context/_index.md` only

## Module to Bootstrap

Fill in before running:

```
Module name:    [e.g., :app/profile]
Source path:    [e.g., app/src/main/java/com/example/views/profile/]
Key classes:    [list from MODULE_MAP.md — e.g., [Feature]ViewModel.kt, [Feature]Fragment.kt]
Context file:   [e.g., context/profile.md]
```

## Affected Areas

[Copy keywords from MODULE_MAP.md entry for this module]

## Testing

- [ ] Not required — this is a read-only context generation task

## Steps for the Agent

1. Read `spec-kit/MODULE_MAP.md` — find the entry for the module being bootstrapped.
2. Read the key source files listed in the `Key classes` field.
3. For each file: extract purpose, public interface, state shape, and dependencies.
4. Scan for tech debt patterns listed in `spec-kit/TECH_DEBT.md`.
5. Scan for existing test files (`*Test.kt`, `*Spec.kt`) in the module path.
6. Populate `context/TEMPLATE.md` fields from what you observed.
7. Save as `context/<module>.md`.
8. Add a routing row to `context/_index.md`.
9. Write a completion report listing what was found and any debt or gaps discovered.

## Notes

Bootstrap runs are fast — typically 5–8 source file reads per module.
Do all modules in `spec-kit/MODULE_MAP.md` before starting feature tickets.
Modules bootstrapped first: those most commonly touched by the current backlog.

If a source file is missing or has been renamed, report it in the completion report
using the Error Recovery Protocol in CLAUDE.md — do not guess at the new location.
