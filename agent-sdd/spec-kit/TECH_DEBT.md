# Tech Debt Register
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads only the sections for modules a task touches.
# Never modifies this file. Debt surfaced during tasks is reported in the
# completion report — a human decides whether to add it here.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: load only the module sections relevant to the current task.
> For every OPEN or SCHEDULED entry in scope: do not replicate the pattern,
> do not remove the workaround unless the task explicitly scopes it.
> When you discover new debt, report it in the completion report — do not
> add it to this file.

## Status Legend

| Status | Meaning |
|--------|---------|
| OPEN | Exists in codebase. Not yet scheduled. |
| SCHEDULED | Assigned to a ticket. See "Scheduled ticket" field. |
| RESOLVED | Fixed. Entry kept for history. |

## How the Agent Uses This File

- Load only sections for modules touched by the current task.
- For each OPEN or SCHEDULED entry in scope: do not replicate the pattern, do not
  remove the workaround unless the task explicitly scopes it.
- Log new debt discovered during task execution in the completion report.
  Do not add entries to this file — a human reviews and decides.

---

## :app {#app}

No known debt. Add entries as discovered.

---

## :feature-auth {#auth}

### DEBT-001 — [Replace with your first auth debt entry]

| Field | Value |
|-------|-------|
| Status | OPEN |
| Location | `[path/to/File.kt]` |
| Impact | [describe what is hard or broken because of this] |
| Agent rule | [exact instruction — e.g., "do not add more X here, new code uses Y"] |
| Scheduled ticket | — |

---

## :feature-home {#home}

No known debt. Add entries as discovered.

---

## :core-network {#network}

No known debt. Add entries as discovered.

---

## :core-data {#data}

No known debt. Add entries as discovered.

---

## :core-ui {#ui}

No known debt. Add entries as discovered.

---

## Resolved {#resolved}

<!-- Move entries here when fixed. Keep for historical reference.

### DEBT-XXX — [Title]

| Field | Value |
|-------|-------|
| Status | RESOLVED |
| Resolved in | [PROJ]-[ID] |
| Resolution | [what was done] |

-->
