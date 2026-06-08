# CLI-Only Setup — No Browser Required

**Setup Agentic SDD entirely from the terminal using Claude CLI.**

---

## Prerequisites

- Claude CLI installed: `npm install -g @anthropic-ai/claude-code`
- Project folder with source code (Android or iOS)
- `agent-sdd/` submodule added to your project

---

## Quick Start

```bash
# 1. Navigate to your project root (where agent-sdd/ is located)
cd /path/to/your/project

# 2. Run the setup task via Claude CLI
claude "Read agent-artifacts/CLAUDE.md and execute agent-sdd/tasks/SETUP.md"

# That's it!
```

Claude will:
1. ✅ Detect your platform (Android or iOS)
2. ✅ Auto-scan project structure (Gradle/Xcode files)
3. ✅ Generate `agent-artifacts/` folder with all spec-kit files
4. ✅ Create context and tasks folders

---

## What Gets Generated

```
agent-artifacts/
├── project.config.md              ← Auto-detected project details
├── spec-kit/
│   ├── ARCHITECTURE.md            ← Generated from project scan
│   ├── MODULE_MAP.md              ← Generated from project structure
│   ├── DATA_MODEL.md              ← Generated from source analysis
│   ├── CONVENTIONS.md             ← Empty template (you fill in)
│   ├── TESTING.md                 ← Empty template (you fill in)
│   ├── MIGRATION_RULES.md         ← Empty template (you fill in)
│   └── TECH_DEBT.md               ← Empty template (you fill in)
├── context/
│   └── _index.md                  ← Empty routing table
└── tasks/                         ← Ready for your task files
```

---

## Next Steps After Setup

### 1. Review Auto-Detected Values

```bash
# Check what was detected
cat agent-artifacts/project.config.md
```

Edit if needed (platform, SDK versions, dependencies, etc.)

### 2. Fill in Human-Authored Specs

Edit these files with your project-specific rules:

```bash
# Code standards and naming conventions
nano agent-artifacts/spec-kit/CONVENTIONS.md

# Test patterns and coverage requirements
nano agent-artifacts/spec-kit/TESTING.md

# Legacy → modern migration rules
nano agent-artifacts/spec-kit/MIGRATION_RULES.md

# Known technical debt register
nano agent-artifacts/spec-kit/TECH_DEBT.md
```

### 3. Commit to Your Repo

```bash
git add agent-artifacts/
git commit -m "Initialize Agentic SDD for this project"
git push
```

### 4. Bootstrap Context Files for Each Module

Once per module (do the most important ones first):

```bash
# Copy the bootstrap template
cp agent-sdd/tasks/BOOTSTRAP_TEMPLATE.md agent-artifacts/tasks/BOOTSTRAP-login.md

# Edit it with your module name and paths
nano agent-artifacts/tasks/BOOTSTRAP-login.md

# Run it
claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/BOOTSTRAP-login.md"
```

### 5. Start Executing Tasks

For each feature/bug ticket:

```bash
# Create task from template
cp agent-sdd/tasks/TASK_TEMPLATE.md agent-artifacts/tasks/PROJ-1234.md

# Fill in the task
nano agent-artifacts/tasks/PROJ-1234.md

# Execute it
claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md"
```

---

## Command Reference

### Full Setup (Once)

```bash
claude "Read agent-artifacts/CLAUDE.md and execute agent-sdd/tasks/SETUP.md"
```

### Bootstrap a Module Context (Once per Module)

```bash
claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/BOOTSTRAP-modulename.md"
```

### Execute a Feature/Bug Task (Repeating)

```bash
claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "agent-artifacts/CLAUDE.md not found" | Run the setup wizard first — it generates `agent-artifacts/CLAUDE.md`. Then run the command from your project root. |
| "agent-artifacts/ not created" | Check Claude output for errors; may need to create manually and retry |
| "Platform detection wrong" | Edit `agent-artifacts/project.config.md` and correct the values |
| "MODULE_MAP.md missing modules" | Add them manually to MODULE_MAP.md, then bootstrap their context |

---

## Why No Browser?

- ✅ Works in CI/CD pipelines
- ✅ Works over SSH (remote servers)
- ✅ Works in headless environments
- ✅ Faster — no UI rendering
- ✅ Self-contained — one command

The browser wizard is still available if you prefer visual interaction:

```bash
open agent-sdd/setup-wizard.html
```

But you don't need it for CLI-first workflows.

---

## Workflow Summary

```
┌─────────────────────────────────────────┐
│ 1. Setup (One time)                     │
│ claude ...SETUP.md                      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 2. Fill in Specs (Manual editing)       │
│ nano CONVENTIONS.md, TESTING.md, etc.   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 3. Bootstrap Modules (Once per module)  │
│ claude ...BOOTSTRAP-login.md            │
│ claude ...BOOTSTRAP-payments.md         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 4. Execute Tasks (Repeating)            │
│ claude ...PROJ-1234.md (feature)        │
│ claude ...PROJ-1235.md (bug fix)        │
└─────────────────────────────────────────┘
```

---

Done! All from the terminal. 🎉
