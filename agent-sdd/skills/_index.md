# Skills Index
# ─────────────────────────────────────────────────────────────────────────────
# Plug-n-play skill modules. A skill is OFF by default and turns ON only when a
# task's `Skills:` line names it. The agent reads this index to know which skills
# exist and where to load each one from.
# ─────────────────────────────────────────────────────────────────────────────

## Available Skills

| Skill | File | What it enforces when active |
|-------|------|------------------------------|
| `ada` | `skills/ada.md` | Accessibility (a11y) compliance for UI the task touches — labels, touch targets, text scaling, color-independent signals. |
| `analytics` | `skills/analytics.md` | Analytics event instrumentation for in-scope user actions / screen views, through the project's existing analytics mechanism, no PII. |

## How a developer turns a skill on

Add the skill name to the task file's `Skills:` line:

```
## Skills

Skills: ada, analytics
```

`Skills: none` (or omitting the line) = no skills active; the agent runs the normal workflow.

## How the agent uses this (summary — full rules in CLAUDE.md Step 2)

1. Read the task's `Skills:` line.
2. For each named skill, load `agent-artifacts/skills/<skill>.md`.
3. Apply each active skill's rules on top of Steps 3–8. A skill never relaxes a
   Hard Rule or the base quality gate — it only adds requirements.
4. If a named skill has no matching file, note the gap and continue — do not stop.

<!-- Add a row here whenever you add a new skill module to skills/. -->
