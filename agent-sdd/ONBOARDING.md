# Onboarding: Understanding the Agentic SDD System

A guide for developers. The goal of this page is simple: explain what this system is
by mapping every piece of it to something you already use every day.

---

## The one-sentence model

> **We treat the AI agent like a senior engineer who just joined the team — so we give it
> the same things a new hire needs to be productive and safe: onboarding docs, an architecture
> wiki, a map of the codebase, a clear ticket, and the same CI/PR guardrails everyone else
> works under.**

Every artifact in this system is just one of those onboarding materials. That's the whole idea.
Nothing here is exotic — it's the stuff you'd give any new engineer, written down so an agent
can use it too.

---

## Why bother? (Before vs. after)

Most of us already paste code into Claude or use Copilot. Here's what changes when you give the
agent a real spec instead of a verbal request:

| | Ad-hoc AI (Copilot / raw prompting) | This SDD system |
|---|---|---|
| **Context** | Re-explain the codebase every time; it forgets | Persistent, cached per-module blueprints |
| **Architecture** | Guesses / hallucinates structure | Reads your real ARCHITECTURE + MODULE_MAP |
| **Scope** | Wanders, refactors things you didn't ask for | Hard scope rules + reviewable diffs |
| **Safety** | Might `git commit`, edit generated files | Hooks deterministically block it; humans own commits |
| **Correctness** | "Looks right" | Must build, run tests, and show evidence |
| **Knowledge** | Lost when the chat closes | Written back into context files for the next session |

One-liner: **Copilot is autocomplete; this is an engineer who reads the docs, follows the
process, and can't merge to main.**

---

## The Rosetta Stone

Each piece of the system maps to a concept you already know:

| SDD piece | It's basically our… | What it does |
|-----------|---------------------|--------------|
| `CLAUDE.md` | Onboarding runbook + Definition of Done | Standing instructions every session reads first: the workflow, the rules, what "done" means. Read-only. |
| The agentic loop | Our SDLC for one ticket | PERCEIVE → PLAN → EXECUTE → EVALUATE → REPORT. Read ticket → design → implement → self-test → open PR. A process, not autocomplete. |
| `spec-kit/ARCHITECTURE.md` | Architecture wiki / C4 doc | The big picture the agent reads before touching code. |
| `spec-kit/CONVENTIONS.md` | Style guide / lint rules in prose | Naming, patterns, the quality bar. |
| `spec-kit/TESTING.md` | Test strategy doc | How and what to test. |
| `spec-kit/MIGRATION_RULES.md` | Migration playbook | Legacy → modern rules with scope guards. |
| `spec-kit/TECH_DEBT.md` | Debt backlog / debt epic | Known debt with per-entry agent rules. |
| `spec-kit/DATA_MODEL.md` | Schema / ERD docs | Data models, APIs, DB shapes. |
| `MODULE_MAP.md` | Service catalog / package registry | Index card per module: where it lives, its pattern, DI, dependencies. |
| `context/_index.md` | URL router (`routes.rb`) or a DB index | Maps task keywords to the right context file. |
| `context/<module>.md` | A per-module README that's actually kept current — plus a cache | The deep blueprint. Caching it means the agent doesn't re-read the whole module each time. |
| `tasks/<TICKET>.md` | A well-written Jira/GitHub issue | The unit of work, with acceptance criteria. |
| Hooks (`.claude/settings.json`) | pre-commit hooks + CI gates | Deterministic guardrails that block bad actions regardless of what the AI decides. |
| The setup wizard | Scaffolding tool (create-react-app / Spring Initializr) | Generates the artifacts from a form. |
| Version banner / `.sdd-version` | `npm outdated` / Dependabot | Tells you when your project's snapshot is behind the skeleton. |

---

## The three-layer knowledge split

The most common point of confusion is the three context files. They are NOT redundant —
they are three different zoom levels, like DNS → service catalog → service README:

| File | Role | Depth | Maintained by |
|------|------|-------|---------------|
| `context/_index.md` | **Router** — keyword → context file | shallow | human |
| `MODULE_MAP.md` | **Registry** — paths, pattern, DI, dependencies | medium | human |
| `context/<module>.md` | **Blueprint** — key files, state shapes, debt with file:line, gotchas | deep | agent (auto-updated) |

Rule of thumb: the **router** finds the module, the **registry** tells you where it lives and
what it depends on, and the **blueprint** is the detailed living doc the agent reads and rewrites.

---

## Who reads what, who writes what

This trips people up, so state it plainly:

- The agent **reads** all of `spec-kit/` and **never edits it.** (Like: it reads the wiki, it
  doesn't rewrite the wiki.)
- The agent **reads and writes** `context/<module>.md`. (Like: it updates the module README
  after a change so the next person — or next session — starts smarter.)
- **Humans own commits.** The agent writes correct, reviewable code; you review and commit it.
  The hooks enforce this — the agent literally cannot run `git commit`/`push`/`add`.

---

## Analogy traps (for the sharp questions you'll get)

- **`_index.md` is routing/indexing, not SEO.** Tempting analogy, but it misleads: in SEO more
  keywords = more reach, so people stuff them. Here, extra/loose keywords cause *mis-routing* —
  the agent loads the wrong module's blueprint. The goal is **precision, not breadth**: only add
  a keyword if a task using that word should genuinely load this module.
- **Hooks vs. CLAUDE.md.** Hooks are *deterministic* — they run no matter what the AI thinks.
  CLAUDE.md is *guidance* — logic, naming, structure. Same split as "CI gate vs. code-review
  guidelines." One blocks; one advises.
- **The agent doesn't "just know" your architecture.** Everything it knows came from an artifact
  a human created or a context file a prior session wrote. Garbage in, garbage out — which is why
  the spec-kit quality matters.

---

## What "done" looks like

When the agent finishes a task, it produces a completion report that includes:

- Files created / modified, each with a one-line reason
- **Build & tests** — it actually compiled and ran tests, and reports the real result
- **Acceptance criteria** — each one checked off with specific evidence (file, function, test name)
- **Security warnings** — any hardcoded secrets it spotted (flagged, never fixed — that's on us)
- **Self-corrections** — what it caught and fixed during its own review
- **Follow-up** — debt introduced or out-of-scope issues noticed

If it can't build or test, it says so — it does not claim success. A failing build or failing
tests means BLOCKED, not done.
