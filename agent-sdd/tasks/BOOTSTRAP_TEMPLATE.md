# Task: BOOTSTRAP — Generate context file for [Module Name]

## Type

- [ ] Bug
- [ ] Feature
- [ ] Refactor
- [x] Task

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

---

## ⚠ EVIDENCE-ONLY RULE — Read this before writing anything

Every line in the context file must be directly supported by something you read
in a source file during this task.

**Never infer. Never assume. Never fill gaps with what a library "typically" does.**

Specific prohibitions:

- **Dependencies**: List only what appears in `import` statements of the files you
  read. Do NOT describe what an imported SDK does internally — only list its name.
  Violation example: "NomNomCore SDK handles authentication."
  Correct: "Depends on: NomNomCore (import seen in AuthViewModel.kt)"

- **State Management**: Only describe `StateFlow`, `LiveData`, or `sealed class` shapes
  you directly read. Do NOT invent domain types (e.g., `AppBasket`) that you did not
  see declared in a source file.

- **What the Agent Should Know**: Only document concrete behaviors you observed in code
  (e.g., "ProfileFragment calls authService.logout() directly on line 84"). Never infer
  a behavior from a class name or SDK reputation.

- **Purpose / "Does NOT handle"**: Only exclude a responsibility if you read a file and
  confirmed it is absent. Do not assume from folder names alone.

If you cannot confirm something from the files you read, write:
`[not confirmed — verify with team]`

Do not leave sections blank to avoid this — write the placeholder explicitly.
A visible gap is safer than a confident wrong answer.

---

## Acceptance Criteria

- [ ] `context/<module>.md` exists and follows the structure in `context/TEMPLATE.md`
- [ ] Key Files table lists only files that were actually read and verified to exist
- [ ] State Management describes only ViewModel/StateFlow shapes seen in source, or "N/A"
- [ ] Dependencies lists import names only — no description of what SDKs do internally
- [ ] "What the Agent Should Know" contains only facts directly observed in source, or "None found"
- [ ] Known Debt lists debt patterns actually seen in scanned files, or "None found"
- [ ] Tests section lists existing test files found, or "No tests found"
- [ ] A routing row for this module is added to `context/_index.md`
- [ ] No section contains an inference — every claim traces to a file you read

## Quality Gate

- [ ] No production source files were created or modified
- [ ] No `spec-kit/` files were modified (read-only)
- [ ] Context file uses the exact section structure from `context/TEMPLATE.md`
- [ ] All file paths in Key Files table are verified to exist (attempted to open each)
- [ ] Any unconfirmed claim is explicitly marked `[not confirmed — verify with team]`

## Out of Scope

- Do NOT fix any code issues discovered during the scan — log them in the completion report
- Do NOT create unit tests — this is a read-only discovery run
- Do NOT modify `spec-kit/MODULE_MAP.md` — add routing to `context/_index.md` only
- Do NOT describe SDK internals beyond what the import statement shows

## Module to Bootstrap

Fill in before running:

```
Module name:    [e.g., :app/profile]
Source path:    [e.g., app/src/main/java/com/example/views/profile/]
Key classes:    [list from MODULE_MAP.md — e.g., ProfileViewModel.kt, ProfileFragment.kt]
Context file:   [e.g., context/profile.md]
```

## Affected Areas

[Copy keywords from MODULE_MAP.md entry for this module]

## Testing

- [ ] Not required — this is a read-only context generation task

## Steps for the Agent

1. Read `agent-artifacts/spec-kit/MODULE_MAP.md` — find the entry for the module being bootstrapped.
2. Read each source file listed in the `Key classes` field. If a file cannot be opened, note it as
   `[not read]` in the Key Files table — do not infer its contents.
3. For each file you successfully read:
   - Note the exact class name, file path, and declared purpose (from KDoc/comments if present)
   - Note any `StateFlow`, `LiveData`, or `sealed class` shapes declared in the file
   - Note `import` statements for the Dependencies section (list names only — no descriptions)
   - Note any `!!` operators, `GlobalScope`, or `LiveData` fields for the Known Debt section
4. Scan for existing test files (`*Test.kt`, `*Spec.kt`) in the module path.
5. Write the context file filling in ONLY what you directly observed in steps 2–4.
   For anything you could not confirm, write `[not confirmed — verify with team]`.
6. Save as `agent-artifacts/context/<module>.md`.
7. Add a routing row to `agent-artifacts/context/_index.md`.
8. Write a completion report:
   - Files successfully read
   - Files that could not be opened (list as gaps)
   - Any `[not confirmed]` placeholders left — the team must review these before the file is used

## Notes

Bootstrap runs are fast — typically 5–8 source file reads per module.
Do all modules in `spec-kit/MODULE_MAP.md` before starting feature tickets.
Modules bootstrapped first: those most commonly touched by the current backlog.

**A context file with `[not confirmed]` placeholders is better than one with confident wrong answers.**
The team can fill gaps in minutes; they cannot easily detect silent errors.
