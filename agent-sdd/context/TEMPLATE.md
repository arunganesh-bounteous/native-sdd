# context/[module-name].md
# ─────────────────────────────────────────────────────────────────────────────
# COPY THIS FILE to create a new module context file.
# Rename to match the module: context/auth.md, context/ordering.md, etc.
# Add a row to context/_index.md pointing to this file.
#
# This file is updated by the agent after every task that touches this module.
# Review context file changes in PRs alongside the code changes.
# ─────────────────────────────────────────────────────────────────────────────

## Module: [Module Name]

**Last updated**: [YYYY-MM-DD] by [agent / human], after [TICKET-ID or "bootstrap"]
**Architecture**: [MVVM / MVP / Clean / None / Mixed]
**Language**: [Kotlin / Kotlin + Java / Swift / TypeScript]
**DI**: [Hilt / Dagger / Manual / None]

---

## Purpose

[2–3 sentences. What user-facing features live here. What this module does NOT do — boundaries matter.]

---

## Key Files

| File (relative to codebase_path) | Role |
|----------------------------------|------|
| `path/to/[Name]ViewModel.kt` | [one-line description] |
| `path/to/[Name]Repository.kt` | [one-line description] |
| `path/to/[Name]Fragment.kt` | [one-line description] |
| `path/to/di/[Name]Module.kt` | [one-line description] |

---

## State Management

[Describe how state flows through this module. What the ViewModel exposes. Sealed class shapes.]

```kotlin
// Example — fill in actual state for this module:
sealed interface [Name]UiState {
    data object Idle : [Name]UiState
    data object Loading : [Name]UiState
    data class Error(val message: String) : [Name]UiState
    data object Success : [Name]UiState
}
```

---

## Dependencies

- **Depends on**: [list modules this imports — e.g., `:core-network`, `:core-data`]
- **Depended on by**: [list modules that import this — e.g., `:app` (NavGraph)]

---

## Known Debt

- [DEBT-XXX — one-line description. See `spec-kit/TECH_DEBT.md#[section]` for agent rules.]

No debt — leave this section empty if none.

---

## Tests

| Test file | What it covers |
|-----------|---------------|
| `path/to/[Name]ViewModelTest.kt` | [scenarios covered] |
| `path/to/[Name]RepositoryTest.kt` | [scenarios covered] |

**Coverage gaps**: [list untested scenarios that would be valuable to add]

---

## What the Agent Should Know

[Non-obvious facts. Gotchas. Invariants. Workarounds that must not be removed. Side effects.]

Examples of what belongs here:
- "Never call [Class] directly from ViewModel — always through [UseCase]"
- "[Field] is nullable in the API response but the UI assumes non-null — guard here"
- "The [workaround] in [File]:L42 exists because [reason] — do not simplify it"
- "Deep links into this module must check [condition] first — see [File] for the pattern"

**Prompting questions to fill this section (delete these when done):**
- Is there a class in this module that must never be called directly from outside? Why?
- Is there a field that is nullable in the API or DB but the UI assumes non-null?
- Is there a workaround that looks wrong but must not be removed or "cleaned up"?
- Are there entry points (deep links, push notifications, back-stack) that require preconditions?
- Is there a singleton or shared state that more than one module writes to?
- Are there fields sourced from two places where one is authoritative and the other is stale?
