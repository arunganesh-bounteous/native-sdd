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

<!-- Selection principle: this is a MAP, not a file inventory.
     List entry points, base classes, DI wiring, and files with non-obvious roles
     or known debt. OMIT routine API interfaces, one-line impls, and files an agent
     would find trivially by name. Prefer ~10–15 high-signal rows; if you exceed
     that, you're probably inventorying, not mapping — cut the obvious ones. -->
| File (relative to codebase_path) | Role |
|----------------------------------|------|
| `path/to/[Name]ViewModel.kt` | [one-line description] |
| `path/to/[Name]Repository.kt` | [one-line description] |
| `path/to/[Name]Fragment.kt` | [one-line description] |
| `path/to/di/[Name]Module.kt` | [one-line description] |

---

## State Management

[Only describe StateFlow / LiveData / sealed class shapes you directly read in source.
Do NOT invent domain types not seen in the code.]

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

<!-- Evidence rule: list only what appears in import statements of files you read.
     Do NOT describe what an SDK does internally — list its name only.
     For anything unconfirmed write: [not confirmed — verify with team] -->
- **Depends on**: [list import names — e.g., `:core-network`, `OloSDK`]
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

<!-- Evidence rule: only document concrete behaviors observed in source code.
     Example of valid entry: "ProfileFragment calls authService.logout() directly — not via ViewModel"
     Example of invalid entry: "The SDK handles session management internally"
     For anything unconfirmed write: [not confirmed — verify with team] -->

- "Never call [Class] directly from ViewModel — always through [UseCase]"
- "[Field] is nullable in the API response but the UI assumes non-null — guard here"
- "The [workaround] in [File]:L42 exists because [reason] — do not simplify it"
