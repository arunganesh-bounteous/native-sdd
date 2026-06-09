# Skill: analytics — Event Instrumentation
# ─────────────────────────────────────────────────────────────────────────────
# A plug-n-play skill module. It is ACTIVE only when a task's `Skills:` line lists
# `analytics`. When active, apply the rules below ON TOP OF the normal Steps 0–8.
# Scope is limited to user actions / screen views in UI the task creates or
# modifies. Read-only for the agent; humans edit this in agent-sdd/skills/.
# ─────────────────────────────────────────────────────────────────────────────

## When this skill is active

The ticket requires user behaviour to be instrumented with analytics/tracking events.
Add events for the user actions and screen views in scope — nothing more.

## Use the project's existing analytics, never invent one

Before adding any event:
1. Find how the project already sends analytics — search the loaded context files and
   source for the existing analytics manager / wrapper / SDK call (e.g. an
   `AnalyticsManager`, `Tracker`, `logEvent(...)`, Firebase `FirebaseAnalytics`).
2. **Route every new event through that existing mechanism.** Do NOT add a new SDK,
   a new wrapper, or direct SDK calls scattered in the UI.
3. If you cannot find an existing analytics mechanism, do NOT guess one — STOP and ask
   the developer which to use (Ambiguity Protocol).

If `spec-kit/CONVENTIONS.md` or `spec-kit/DATA_MODEL.md` defines an event naming
convention or schema, follow it exactly. Otherwise default to `snake_case` event names.

## What it adds to your workflow

- **Step 3 (Understanding):** add `**Analytics (analytics):** active — <actions/screens to instrument>` and name the existing analytics mechanism you will use.
- **Step 5 (Execute):** fire events from the correct layer (prefer ViewModel/Presenter over View, matching the project's pattern), through the existing analytics wrapper.
- **Step 6 (Self-Verification):** run the Analytics Gate below.
- **Step 8 (Completion report):** add an `### Analytics (analytics)` section listing every event.

## Analytics Gate

| Check | Rule |
|-------|------|
| Existing mechanism | Events go through the project's existing analytics wrapper — no new SDK or ad-hoc calls. |
| Naming | Event + property names follow the project convention (or `snake_case` default); consistent tense/voice. |
| Coverage | Every in-scope user action and screen view has an event — no silent gaps. |
| No PII | No emails, names, phone numbers, tokens, precise location, or free-text user input in event params. Use stable IDs only. |
| Layer | Events fire from the layer the project uses (typically ViewModel/Presenter), not buried in UI callbacks unless that is the established pattern. |
| No duplicates | The same action does not fire the same event from two places. |

## Evidence & honesty rule

- List every event with its name, properties, and the exact trigger location (file:line).
- If a property value's source is unclear or could contain PII, flag it rather than shipping it.
- Do not claim an event "fires correctly" without pointing to where it is dispatched.

## Completion report section

```
### Analytics (analytics)
- Mechanism used: [AnalyticsManager / Firebase / ... — file]
- Events added:
  - `event_name` — props: [key: type] — fired at [file:line] when [trigger]
- PII check: [pass — no PII in params / flagged: ...]
```
