# Architecture Decision: CLAUDE.md Ownership & Project Self-Containment

**Date:** 2026-05-21  
**Status:** ✅ Implemented  
**Decision:** Copy CLAUDE.md to agent-artifacts/ during wizard setup

> **Update (single source of truth):** The wizard no longer reads a standalone
> `agent-sdd/CLAUDE.md` file at setup time. Instead, the clean source files
> (`agent-sdd/CLAUDE.md`, `hooks/**`, task/context templates) are the **editable
> source of truth**, and a maintainer-only build step,
> `agent-sdd/engine/generate-embedded.js`, embeds their contents into
> `agent-sdd/engine/wizard-core.js` as `EMBEDDED_*` template-literal constants
> (`EMBEDDED_CLAUDE_MD`, `EMBEDDED_GIT_GUARD_SH`, etc.). The wizard writes these
> embedded strings directly to `agent-artifacts/`. This forward-generation model
> keeps one source of truth (edit the file, run the generator) with no drift and
> no Node dependency on the end-user side. Everything below about *why* the
> snapshot lives in `agent-artifacts/` still holds — only the mechanism changed
> from "copy a file" to "write an embedded string."
>
> **Versioning:** `agent-sdd/VERSION` is stamped into the CLAUDE.md snapshot and
> emitted as `SKELETON_VERSION`. The wizard writes `agent-artifacts/.sdd-version`
> at setup and, on a later run, compares it to `SKELETON_VERSION` to show an
> "update available" banner when a project is on an older snapshot.

---

## Problem Statement

**Original Approach:**
```bash
claude "Read agent-sdd/CLAUDE.md and execute ..."
```

**Issues:**
1. Hardcoded path dependency on `agent-sdd/` folder location
2. Moving/renaming the `agent-sdd/` folder breaks ALL project workflows
3. Projects cannot run independently from the tool folder
4. Fragile for CI/CD, Docker containers, and remote environments

---

## Solution

**New Approach:**
```bash
claude "Read agent-artifacts/CLAUDE.md and execute ..."
```

**How It Works:**

### 1. Setup Wizard Copies CLAUDE.md
When user completes the setup wizard (saves the final step):
- Wizard reads `agent-sdd/CLAUDE.md` (source of truth)
- Wizard writes copy to `agent-artifacts/CLAUDE.md`
- Copy is identical to source at setup time

```
┌──────────────────────────────────────┐
│ agent-sdd/ (Tool — Git Submodule)    │
│                                      │
│  ├── CLAUDE.md ← Source of truth     │
│  ├── setup-wizard.html               │
│  ├── engine/                         │
│  └── ...                             │
└──────────────────────────────────────┘
           ↓ [Setup Wizard Copies]
┌──────────────────────────────────────┐
│ agent-artifacts/ (Project — Git)     │
│                                      │
│  ├── CLAUDE.md ← Read-only snapshot  │
│  ├── project.config.md               │
│  ├── spec-kit/                       │
│  ├── context/                        │
│  └── tasks/                          │
└──────────────────────────────────────┘
```

### 2. Projects Are Self-Contained
Each project has everything it needs in `agent-artifacts/`:
```bash
cd /my/project
claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md"

# ✅ Works regardless of where agent-sdd/ is located
# ✅ Works in Docker, CI/CD, remote servers
# ✅ Works if agent-sdd/ folder is deleted (legacy projects still run)
# ✅ No external path dependencies
```

### 3. Read-Only Protection
- Hooks block all writes to `agent-artifacts/CLAUDE.md`
- Prevents accidental edits during task execution
- Projects cannot diverge from tool's agent protocol

### 4. Version Management
- Snapshot approach: projects keep the version from setup time
- To get updates: re-run setup wizard → copies latest CLAUDE.md
- Explicit process, not automatic (avoids surprises)

---

## Benefits

| Benefit | Impact |
|---------|--------|
| **Self-Contained Projects** | Projects work independently; no external path deps |
| **Resilient to Folder Moves** | Moving/renaming agent-sdd doesn't break workflows |
| **CI/CD Friendly** | Works in Docker, remote servers, headless environments |
| **Version Snapshots** | Each project has the agent version it was set up with |
| **Future-Proof** | Node.js CLI integration (next version) will use same pattern |
| **Clearer Semantics** | agent-artifacts/ = "everything needed to run" |

---

## Implementation Details

### Wizard Changes (wizard-core.js)

**New Function:**
```javascript
// Copy CLAUDE.md from agent-sdd/ to agent-artifacts/ as read-only reference
async function copyCLAUDEmdToArtifacts() {
  // Reads: agent-sdd/CLAUDE.md
  // Writes: agent-artifacts/CLAUDE.md
  // Called when user saves final step (datamodel)
}
```

**Integration:**
```javascript
// In saveStep() function, when stepId === 'datamodel':
if (stepId === 'datamodel') {
  await copyCLAUDEmdToArtifacts();
}
```

### Hooks Changes (settings.json)

**Added Protections:**
```json
"deny": [
  "Write(agent-artifacts/CLAUDE.md)",
  "Edit(agent-artifacts/CLAUDE.md)"
]
```

This prevents accidental edits during task execution.

### Documentation Changes

All references updated:
- `agent-sdd/CLAUDE.md` → `agent-artifacts/CLAUDE.md` (in execution commands)
- `agent-sdd/CLAUDE.md` (preserved for source reference in architecture docs)
- Added header note to CLAUDE.md explaining the copy mechanism

### Updated Files

1. **engine/wizard-core.js**
   - Added `copyCLAUDEmdToArtifacts()` function
   - Integrated into `saveStep()` when final step completes

2. **hooks/settings.json**
   - Added protection rules for `agent-artifacts/CLAUDE.md`
   - Updated `agent-sdd-output/` → `agent-artifacts/` references

3. **CLAUDE.md**
   - Added header explaining copy mechanism
   - Clarified that agent-artifacts/CLAUDE.md is snapshot

4. **README.md**
   - All task examples now use `agent-artifacts/CLAUDE.md`
   - Clarified workflow

5. **New Files**
   - `CLI_SETUP.md` — Terminal-only setup workflow
   - `tasks/SETUP.md` — Bootstrap task for project initialization
   - `ARCHITECTURE_DECISION.md` — This document

---

## User Workflow

### For New Projects

```bash
# 1. Setup (Browser or CLI)
open agent-sdd/setup-wizard.html
# → Wizard automatically copies CLAUDE.md to agent-artifacts/

# 2. Run tasks (Terminal Only)
cd /project
claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md"
# ✅ Works anywhere, no path dependency
```

### For Existing Projects (Before This Change)

If projects were using `Read agent-sdd/CLAUDE.md`:
- Still works (backward compatible)
- Recommend copying CLAUDE.md manually for self-containment:
  ```bash
  cp agent-sdd/CLAUDE.md agent-artifacts/CLAUDE.md
  ```
- Update task commands to use `agent-artifacts/CLAUDE.md`

---

## Future Implications

**Next Version (Option B):** Node.js CLI Integration
```bash
# Run setup from CLI without browser
node agent-sdd/cli.js init
# → Generates agent-artifacts/ including CLAUDE.md

# Run tasks from CLI
node agent-sdd/cli.js run agent-artifacts/tasks/PROJ-1234.md
```

This architecture (CLAUDE.md in agent-artifacts/) supports this cleanly.

---

## Questions This Answers

**Q: Why copy CLAUDE.md instead of keeping it in agent-sdd/?**  
A: Projects need to be self-contained. Copying makes them independent of agent-sdd location.

**Q: What if agent-sdd/CLAUDE.md changes?**  
A: Projects keep the version from their setup date. To update, re-run the wizard.

**Q: Is the copy protected?**  
A: Yes, hooks block all writes. It's read-only.

**Q: Can I manually edit agent-artifacts/CLAUDE.md?**  
A: No, hooks prevent it. To customize agent behavior, use project-specific specs (CONVENTIONS.md, TESTING.md, etc.).

**Q: What about version control?**  
A: Commit agent-artifacts/CLAUDE.md with your project. It's a snapshot of what the agent was instructed with.

---

## Rollback Plan (If Needed)

If this approach causes issues:
1. Revert wizard-core.js to not copy CLAUDE.md
2. Update documentation to use `agent-sdd/CLAUDE.md` paths
3. Projects continue to work with original approach

But we believe this approach is correct for long-term maintainability.

---

## Sign-Off

✅ **Implementation Complete**  
⚠️ **Tests**: No automated test suite exists for the wizard engine. The parser and detection logic are manually verified. A Node.js test suite is tracked as a known gap.  
✅ **Documentation Updated**  
✅ **Ready for Production**
