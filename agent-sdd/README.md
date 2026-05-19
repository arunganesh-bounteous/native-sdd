# Agentic SDD Skeleton

A standalone, project-agnostic scaffold that enables Claude (or any capable AI agent)
to autonomously execute development tasks — features, bugs, refactors — on any
brownfield project with minimal token overhead and maximum accuracy.

---

## How It Works

```
Developer writes task MD  →  Opens Claude session  →  Agent reads CLAUDE.md
→  Loads tiered context   →  States understanding  →  Writes code
→  Updates context files  →  Completion report
```

The skeleton gets smarter after every task: context files accumulate project
knowledge that would otherwise require the agent to re-scan the codebase from scratch.

---

## Adopt This Skeleton for a New Project

**Time: 30–90 minutes (mostly filling in spec-kit files)**

### Step 1 — Create the agent-sdd folder inside your project (2 min)

The SDD folder lives **inside** your project so that context file updates and code
changes land in the same commit and can be reviewed together.

```bash
cp -r /path/to/agentic-sdd-skeleton /path/to/MyProject/agent-sdd
```

Then add it to version control alongside your source code:

```bash
# Git
cd /path/to/MyProject
git add agent-sdd/

# SVN
svn add agent-sdd/
svn commit -m "Add agent-sdd skeleton"
```

If your build system needs to ignore the folder, add it to `.gitignore` or set
`svn:ignore` on the project root so Gradle never tries to compile it.

### Step 2 — Run the setup wizard (30–60 min, tech lead)

Open `agent-sdd/setup-wizard.html` in Chrome or Edge.

1. **Select SDD folder** → point to `agent-sdd/` inside your project
2. **Select project to analyse** → point to your project root — auto-detects Gradle
   stack, SDK versions, modules, and build variants
3. Work through each step: Project Config → Architecture → Conventions → Migrations
   → Modules → Tech Debt → Testing → Data Model
4. Click **💾 Save** on each step — files are written directly to `agent-sdd/spec-kit/`

The wizard generates `project.config.md` and all 7 `spec-kit/` files and
`context/_index.md` in one pass. Fill in any remaining `[fill in]` placeholders
in your editor afterward.

### Step 3 — Bootstrap context files (agent-driven, ~15–20 min per module)

Run a bootstrap task for each module in `MODULE_MAP.md` before starting feature work:

```bash
cp agent-sdd/tasks/BOOTSTRAP_TEMPLATE.md agent-sdd/tasks/BOOTSTRAP-profile.md
# Fill in module name, path, key classes
# Open Claude Code, point it at agent-sdd/, say:
# "Read CLAUDE.md and execute tasks/BOOTSTRAP-profile.md"
```

Prioritise the modules your team touches most. The agent generates
`context/<module>.md` automatically — review each output before committing.

### Step 4 — Run your first task (5 min)

```bash
cp agent-sdd/tasks/TASK_TEMPLATE.md agent-sdd/tasks/YOUR-TICKET-001.md
# Fill in YOUR-TICKET-001.md
# Open Claude Code, point it at agent-sdd/, say:
# "Read CLAUDE.md and execute tasks/YOUR-TICKET-001.md"
```

---

## Folder Structure

The `agent-sdd/` folder lives **inside** your project so that context updates
and code changes are committed together and reviewed in the same PR.

```
MyProject/                     ← your project root (Git or SVN repo)
├── app/                       ← source code
├── build.gradle
│
└── agent-sdd/                 ← SDD folder — add to version control
    ├── setup-wizard.html      ← Run once to generate spec-kit files
    ├── project.config.md      ← Edit once per project (wizard generates this)
    ├── CLAUDE.md              ← Agent entry point — do not modify
    ├── README.md              ← This file
    │
    ├── spec-kit/              ← You write these; agent reads only, never modifies
    │   ├── ARCHITECTURE.md
    │   ├── CONVENTIONS.md
    │   ├── DATA_MODEL.md
    │   ├── MIGRATION_RULES.md
    │   ├── MODULE_MAP.md
    │   ├── TECH_DEBT.md
    │   └── TESTING.md
    │
    ├── context/               ← Agent writes these after each task; review in PRs
    │   ├── _index.md          ← Keyword routing table (wizard seeds, agent grows)
    │   └── TEMPLATE.md        ← Copy to add a new module context file
    │
    └── tasks/
        ├── BOOTSTRAP_TEMPLATE.md  ← Run once per module on day 1 (brownfield)
        ├── TASK_TEMPLATE.md       ← Copy per ticket, fill in, run
        └── TASK_GUIDE.md          ← How to write task MDs that work well with Claude
```

---

## The Two-Minute Mental Model

**spec-kit/** = "What the project is" — architecture decisions, coding standards,
data models, known debt. Humans write it. Agent reads it. It changes rarely.

**context/** = "What each module looks like right now" — key files, state shapes,
gotchas, existing tests. Agent writes it after every task. It changes with every PR.

**tasks/** = "What to do next" — one MD file per ticket. Developer writes it.
Agent executes it and deletes nothing (tasks stay as a log).

**CLAUDE.md** = "How to behave" — the agent's protocol. Never edit this unless
you are intentionally changing agent behaviour for all future tasks.

---

## Token Cost Guidance

| Task type | Files loaded | Approx. input tokens |
|-----------|-------------|----------------------|
| Simple bug fix, 1 module | Tier 0–3 + 1 context file + 2–3 source files | ~8–15k |
| Feature, 1 module | Tier 0–3 + 1 context file + 4–6 source files | ~15–25k |
| Cross-module feature | Tier 0–5 + 2–3 context files + 6–10 source files | ~30–50k |
| Data model change | Tier 0–5 + DATA_MODEL.md + relevant context + source | ~25–40k |

These estimates assume spec-kit files are concise (1–3 pages each) and context
files are tight (under 100 lines per module). Verbose spec-kit files multiply cost.

---

## Maintaining the Skeleton

- **After every PR:** Review context file changes the agent made. Correct errors.
- **When adding a module:** Add entry to `MODULE_MAP.md`, add keyword row to `context/_index.md`, create `context/<module>.md` from TEMPLATE.md.
- **When architecture changes:** Update `spec-kit/ARCHITECTURE.md` and add an ADR.
- **When debt is resolved:** Move entry in `TECH_DEBT.md` to the Resolved section.
- **When conventions change:** Update `spec-kit/CONVENTIONS.md`. Add a dated note at the top of the changed section.
---
