# Agentic SDD Skeleton

A project-agnostic scaffold that enables Claude (or any capable AI agent) to
autonomously execute development tasks — features, bugs, refactors — on any
mobile or backend project with consistent quality and minimal token overhead.

> **Spec is the heart of SDD. Context is the memory.**
>
> Spec defines the rules that never change. Context records what the agent
> learned about your codebase. Together they let Claude walk into any task
> already knowing what to do and how to do it.

---

## How It Works

```
Developer writes task MD  →  Agent reads CLAUDE.md
→  Loads spec-kit (rules)  →  Loads context (module knowledge)
→  States understanding    →  Writes code
→  Updates context files   →  Completion report
```

The skeleton gets smarter after every task — context files accumulate module
knowledge so the agent never re-scans the same codebase from scratch.

---

## Folder Structure

```
MyProject/                        ← your project root
├── app/                          ← source code
│
└── agent-sdd/                    ← SDD folder — commit alongside source code
    ├── setup-wizard.html         ← Run once to generate all spec-kit files
    ├── wizard-core.js            ← Wizard engine (do not modify)
    ├── platform-android.js       ← Android wizard module
    ├── platform-ios.js           ← iOS wizard module
    ├── project.config.md         ← One-time project config (wizard generates)
    ├── CLAUDE.md                 ← Agent entry point — do not modify
    │
    ├── spec-kit/                 ← The heart — humans write, agent reads only
    │   ├── ARCHITECTURE.md       ← AI artifact — module structure, ADRs, patterns
    │   ├── MODULE_MAP.md         ← AI artifact — module registry, paths, key classes
    │   ├── DATA_MODEL.md         ← AI artifact — entities, API contracts, mappings
    │   ├── CONVENTIONS.md        ← Human-authored — coding standards, quality gate
    │   ├── MIGRATION_RULES.md    ← Human-authored — legacy → modern rules + scope guard
    │   ├── TECH_DEBT.md          ← Human-authored — debt register with agent rules
    │   └── TESTING.md            ← Human-authored — framework, patterns, coverage
    │
    ├── context/                  ← The memory — agent writes, humans review in PRs
    │   ├── _index.md             ← Keyword routing table (wizard seeds, agent grows)
    │   ├── TEMPLATE.md           ← Copy this to add a new module context file
    │   └── <module>.md           ← One file per module, agent maintains these
    │
    ├── tasks/
    │   ├── TASK_TEMPLATE.md      ← Copy per ticket, fill in, run
    │   ├── TASK_GUIDE.md         ← How to write task MDs that work well with Claude
    │   ├── BOOTSTRAP_TEMPLATE.md ← Run once per module on day 1 (brownfield setup)
    │   └── [PROJ]-1234.md        ← Your task files live here
    │
    ├── examples/
    │   └── EXAMPLE-TASK.md       ← Reference example of a well-written task MD
    │
    └── tutorial.html             ← Full SDD workflow guide
    └── tutorial-spec-kit.html    ← Spec-kit files deep dive
    └── tutorial-spec-files.html  ← MODULE_MAP and DATA_MODEL authoring guide
```

---

## Adopting This Skeleton — Step by Step

**Total time: 1–2 hours on day 1. Then 5 minutes per task.**

---

### Step 1 — Copy the skeleton into your project (2 min)

```bash
cp -r /path/to/agentic-sdd-skeleton /path/to/MyProject/agent-sdd
cd /path/to/MyProject
git add agent-sdd/
```

The SDD folder lives **inside** your project so context file updates and code
changes are committed together and reviewed in the same PR.

---

### Step 2 — Run the setup wizard (30–60 min)

Open `agent-sdd/setup-wizard.html` in **Chrome or Edge** (File System Access
API is required for direct file saving — other browsers download files instead).

**On load:** Select your platform — Android or iOS. The wizard loads the right
stack options automatically.

**Work through each step:**

| Step | Output file | Type |
|------|-------------|------|
| Project Config | `project.config.md` | You fill in |
| Architecture | `spec-kit/ARCHITECTURE.md` | Wizard generates |
| Conventions | `spec-kit/CONVENTIONS.md` | You fill in |
| Migration Rules | `spec-kit/MIGRATION_RULES.md` | You fill in |
| Modules | `spec-kit/MODULE_MAP.md` | Wizard generates |
| Tech Debt | `spec-kit/TECH_DEBT.md` | You fill in |
| Testing | `spec-kit/TESTING.md` | You fill in |
| Data Model | `spec-kit/DATA_MODEL.md` | Wizard generates |

Each step has a **📖 View tutorial** link in the header — click it to open the
relevant tutorial section in a new tab.

Click **💾 Save** on each step. Files are written directly to `agent-sdd/` in
your project folder. The sidebar shows ✅ for saved steps.

After saving, open each generated file and replace any `[fill in]` placeholders
with your project-specific details.

---

### Step 3 — Bootstrap context files (15–20 min per module)

On day 1, the `context/` folder is empty. The agent needs a context file per
module to work accurately without scanning from scratch each time.

Run a bootstrap task for each module your team is about to touch:

```bash
cp agent-sdd/tasks/BOOTSTRAP_TEMPLATE.md agent-sdd/tasks/BOOTSTRAP-login.md
# Fill in: module name, source path, key classes from MODULE_MAP.md
```

Then in Claude Code:
```
Read CLAUDE.md and execute tasks/BOOTSTRAP-login.md
```

Claude reads the source files, extracts structure, and writes
`context/login.md`. No production code is created or modified.

**Tip:** Don't bootstrap all modules at once. Start with the 3–5 modules your
current sprint touches. Bootstrap others as tasks arrive.

---

### Step 4 — Run your first task (5 min per ticket)

```bash
cp agent-sdd/tasks/TASK_TEMPLATE.md agent-sdd/tasks/[PROJ]-1234.md
# Fill in the ticket details
```

In Claude Code:
```
Read CLAUDE.md and execute tasks/[PROJ]-1234.md
```

The agent loads the right spec and context files, states its understanding,
writes the code, updates the context file, and produces a completion report.

---

## The Mental Model

| | What it is | Who writes it | When it changes |
|--|--|--|--|
| **spec-kit/** (heart) | Rules, standards, architecture | Tech lead | Rarely — when decisions change |
| **context/** (memory) | Module knowledge, file maps, state shapes | Agent | Every task that touches the module |
| **tasks/** | Ticket specifications | Developer | Per ticket |
| **CLAUDE.md** | Agent protocol | Skeleton author | Almost never |

**spec-kit** tells the agent *how to work*. **context** tells it *what the
codebase looks like*. Both are needed for accurate, in-scope output.

---

## Token Cost Guidance

| Task type | Files loaded | Approx. input tokens |
|-----------|-------------|----------------------|
| Simple bug fix (1 module) | spec-kit + 1 context + 2–3 source files | ~8–15k |
| Feature (1 module) | spec-kit + 1 context + 4–6 source files | ~15–25k |
| Cross-module feature | spec-kit + 2–3 context + 6–10 source files | ~30–50k |
| Data model change | spec-kit + DATA_MODEL + context + source | ~25–40k |

Keep spec-kit files concise (1–3 pages each) and context files tight (under
100 lines per module). Verbose spec files multiply cost on every task.

---

## Maintaining the Skeleton

- **After every PR** — review context file changes the agent made. Correct errors before merging.
- **New module added** — add entry to `MODULE_MAP.md`, add keyword row to `context/_index.md`, run a bootstrap task.
- **Architecture decision changed** — update `ARCHITECTURE.md` and add an ADR with the reason.
- **Debt resolved** — move the entry in `TECH_DEBT.md` to the Resolved section.
- **Conventions updated** — update `CONVENTIONS.md` and add a dated note at the top of the changed section so the agent knows it was intentional.

---

## Supported Platforms

| Platform | Wizard module | Language detection |
|----------|--------------|-------------------|
| Android | `platform-android.js` | Gradle scan — Kotlin / Java |
| iOS | `platform-ios.js` | Source scan — Swift / Objective-C / Mixed |

---

## Tutorials

All tutorials open directly from the wizard header links or from the sidebar.

| File | Covers |
|------|--------|
| `tutorial.html` | Full SDD workflow — folder structure, spec-kit, tasks, agent protocol |
| `tutorial-spec-kit.html` | Every spec-kit file — fields, what to get right, common mistakes |
| `tutorial-spec-files.html` | MODULE_MAP and DATA_MODEL authoring in depth |
