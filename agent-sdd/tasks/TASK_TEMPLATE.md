# Task: [TICKET-ID] — [Title]
# ─────────────────────────────────────────────────────────────────────────────
# HOW TO USE:
# 1. Rename this file: PROJ-1234.md
# 2. Fill in every section below (remove comments as you go)
# 3. From your project terminal run:
#    claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md"
# ─────────────────────────────────────────────────────────────────────────────

## Type

- [ ] Feature
- [ ] Bug
- [ ] Refactor
- [ ] Task

## Description

<!--
What needs to be done and why.
Include user-facing impact if relevant.
1–5 sentences. Be specific about what changes, not just what the outcome is.

Good: "Add a store_selected Firebase event fired when the user taps a store in
SelectStoreFragment. The event must include store_id as a property."
Bad: "Track store selection in analytics."
-->

[Description here]

## Acceptance Criteria

<!--
Each criterion must be verifiable — the agent should be able to point to a
specific file, function, or test result as evidence.

Good: "TrackStoreSelectedEvent is called in SelectStoreFragment.onStoreClicked()
with the correct store_id property."
Bad: "Store selection is tracked."

The agent checks each one with evidence in the completion report.
If a criterion cannot be verified, it is marked BLOCKED with a reason.
-->

- [ ] [Criterion 1 — what is true when this is done, stated precisely]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Quality Gate

<!--
Technical checks the agent must pass before marking the task complete.
Leave defaults unless your task has specific overrides.
-->

- [ ] No `!!` operators introduced
- [ ] No new `LiveData` introduced — new state uses `StateFlow`
- [ ] No hardcoded strings, colors, or dimensions
- [ ] All `when` on sealed types are exhaustive — no `else`
- [ ] No business logic in UI layer
- [ ] Tests follow `functionName_scenario_expectedResult` naming
- [ ] [Add task-specific check if needed]

## Out of Scope

<!--
Explicitly state what NOT to do. This prevents over-engineering.
Even if related, if it's not in scope, list it here.

Example: "Do not track this event in Adjust — Firebase only."
-->

- [Out of scope item 1]

## Affected Areas

<!--
A one-line hint that helps the agent load the right context files faster.
Use module names, feature names, or file names.

Example: "analytics, store selection flow, SelectStoreFragment"
-->

[e.g., analytics, basket flow, checkout screen]

## Testing

Required: Y / N

<!--
If Y, specify the level and key scenarios.
Write scenarios as verifiable statements — the agent checks each one off.
If N, the agent will still log what could be tested in the completion report.
-->

Level: Unit / Integration / Both

Scenarios:
- [ ] [Scenario 1 — e.g., "event fires with correct store_id when store is tapped"]
- [ ] [Scenario 2 — e.g., "event does not fire when store selection is cancelled"]

## Designs / References

<!--
Figma links, Confluence pages, API docs, Jira tickets, local file paths.
If none, write "None."
-->

- [Link or file path]

## Notes

<!--
Backend changes required? API contracts changing?
Known gotchas or edge cases?
Dependency on another in-progress ticket?
Leave blank if none.
-->

[Notes here or remove section]
