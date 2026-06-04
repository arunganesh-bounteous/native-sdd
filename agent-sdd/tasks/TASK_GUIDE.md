# How to Write Task MDs That Work Well With Claude

This guide helps your team write task MD files that produce accurate, in-scope,
production-quality code from Claude on the first attempt.

---

## The Mental Model

Claude is a skilled engineer who:
- Reads the task MD as the complete specification
- Follows `spec-kit/CONVENTIONS.md` and `spec-kit/MIGRATION_RULES.md` exactly
- Treats the acceptance criteria as its definition of done
- Will not do work that isn't described — and won't skip work that is

Your task MD is the contract. Precision in → precision out.

---

## The Five Rules

### 1. Acceptance criteria are the contract

Claude checks every criterion off in the completion report. Vague criteria = vague output.

**Bad:**
```
- [ ] Analytics works correctly
```

**Good:**
```
- [ ] store_selected event fires when user taps a store in SelectStoreFragment
- [ ] Event includes store_id property matching store.id from the AppStore object
- [ ] Event is NOT sent to Adjust — Firebase only
```

Write criteria as: **"[thing] happens when [condition]"** or **"[thing] is [value] when [condition]"**.

---

### 2. Out of scope is as important as in scope

If you don't say what NOT to do, Claude may implement related things it thinks are helpful.

**Example — bad (no out-of-scope section):**
```
## Description
Track store selection in Firebase analytics.
```
Claude might also add Adjust tracking, update existing analytics methods, or add a test for
every analytics method in the file.

**Example — good:**
```
## Out of Scope
- Do not add Adjust tracking — Firebase only
- Do not modify existing trackBasketTransfer() method
- Do not add tests for pre-existing analytics methods
```

---

### 3. One task = one ticket

Don't bundle unrelated changes. Claude respects scope boundaries — bundled tasks produce
larger, harder-to-review diffs and increase the chance of something going wrong.

If a feature requires backend changes + UI changes + analytics: write three tasks.
Reference each from the others in the Notes section.

---

### 4. Affected areas accelerate context loading

Even a one-word hint saves Claude from scanning the wrong modules.

```
## Affected Areas
analytics, store selection, SelectStoreFragment, BasketViewModel
```

Claude uses this to load the right context files before reading any source files.
Without it, Claude still finds the right files — but it takes more tokens and time.

---

### 5. Test scenarios are prompts, not just checkboxes

If you list test scenarios, Claude writes tests for exactly those scenarios plus edge cases.
If you leave the section empty, Claude writes tests based on what it thinks matters.

Both work. But listing scenarios produces more targeted tests.

```
Scenarios:
- [ ] Event fires with correct store_id when store is tapped
- [ ] Event does not fire when back is pressed from store list
- [ ] store_id matches basket.store.id during basket creation
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Vague description ("improve analytics") | Describe exactly what event, property, and trigger |
| No out-of-scope section | Always list at least one exclusion |
| Bundling backend + frontend + analytics in one task | Split into separate task MDs |
| Acceptance criteria that can't be verified ("works correctly") | Rewrite as observable behaviour |
| Leaving "Affected Areas" blank | Add at minimum the feature name and one class name |
| "Testing: N" with no explanation | OK, but Claude will still note what could be tested |

---

## Example: Good Task MD

```markdown
# Task: [PROJ]-2001 — Track store_selected Firebase event

## Type
- [x] Feature

## Description
Add a store_selected Firebase Analytics event fired when the user selects a store
in SelectStorePickupTabStoreHomeFragment. The event must include store_id as a property.
This is Firebase only — Adjust must not receive this event.

## Acceptance Criteria
- [ ] store_selected event fires when onStoreSelected() is called in SelectStorePickupTabStoreHomeFragment
- [ ] Event includes store_id property with value store.id (String)
- [ ] Event is logged via Analytics.getInstance() using the existing Firebase analytics singleton
- [ ] Event is NOT tracked in AdjustAnalytics

## Out of Scope
- Do not modify AdjustAnalytics.kt
- Do not add store_selected tracking for the delivery flow (separate ticket [PROJ]-2002)
- Do not add tests for pre-existing Analytics methods

## Affected Areas
analytics, store selection, SelectStorePickupTabStoreHomeFragment, Analytics.kt

## Testing
Required: Y
Level: Unit
Scenarios:
- [ ] Analytics.trackStoreSelected() is called with correct store_id when onStoreSelected() fires
- [ ] AdjustAnalytics is NOT called during store selection

## Designs / References
- [PROJ]-1998 (parent analytics ticket)

## Notes
Analytics.kt is a singleton object — inject it via Analytics.getInstance() consistent
with existing call sites. Do not refactor to constructor injection in this task.
```

---

## After Claude Finishes

1. Review the completion report — check each criterion is ticked or has a reason.
2. Review context file changes alongside code changes in the same PR. Look for:
   - New entries in the Key Files table — confirm the file paths are real and accurate
   - State Management or Known Patterns sections — check they reflect the actual code, not assumptions
   - Any `[not confirmed — verify with team]` placeholders (these appear after bootstrap runs, but can also appear in task updates if Claude couldn't confirm something from source) — replace them with the correct information or remove if not applicable
3. Review "Follow-up recommended" — add any new debt entries to `spec-kit/TECH_DEBT.md` if warranted.
4. Delete the task MD after the PR merges, or keep it as a log — your team's choice.

---
