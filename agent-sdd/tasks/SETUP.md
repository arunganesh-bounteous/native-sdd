# Task: SETUP — Initialize Agentic SDD for This Project

## Type

- [ ] Bug
- [ ] Feature
- [ ] Refactor
- [x] Task

## Description

**Initial setup run — generates all agent-artifacts/ files to bootstrap the Agentic SDD system.**

This is a one-time setup task. Run this from the project root to:
1. Detect your platform (Android or iOS)
2. Auto-scan your project structure (Gradle, Xcode, dependencies)
3. Generate `agent-artifacts/project.config.md` with auto-detected values
4. Generate `agent-artifacts/spec-kit/ARCHITECTURE.md`, `MODULE_MAP.md`, `DATA_MODEL.md`
5. Create empty `agent-artifacts/context/` and `agent-artifacts/tasks/` folders
6. Create `agent-artifacts/context/_index.md` routing table

You will then fill in the human-authored specs (CONVENTIONS.md, TESTING.md, MIGRATION_RULES.md, TECH_DEBT.md) interactively or manually.

## How to Run

```bash
# From your project root folder (where agent-sdd/ is located)
claude "Read agent-artifacts/CLAUDE.md and execute agent-sdd/tasks/SETUP.md"
```

That's it. No browser wizard needed.

## Acceptance Criteria

- [ ] `agent-artifacts/` folder created in project root
- [ ] `agent-artifacts/project.config.md` exists with auto-detected platform and stack
- [ ] `agent-artifacts/spec-kit/ARCHITECTURE.md` generated (AI artifact)
- [ ] `agent-artifacts/spec-kit/MODULE_MAP.md` generated (AI artifact)
- [ ] `agent-artifacts/spec-kit/DATA_MODEL.md` generated (AI artifact)
- [ ] `agent-artifacts/spec-kit/CONVENTIONS.md` created (empty template, human to fill)
- [ ] `agent-artifacts/spec-kit/TESTING.md` created (empty template, human to fill)
- [ ] `agent-artifacts/spec-kit/MIGRATION_RULES.md` created (empty template, human to fill)
- [ ] `agent-artifacts/spec-kit/TECH_DEBT.md` created (empty template, human to fill)
- [ ] `agent-artifacts/context/` folder created with `_index.md` (empty routing table)
- [ ] `agent-artifacts/tasks/` folder created (ready for task files)

## Quality Gate

- [ ] All generated files follow SDD structure from templates
- [ ] No source files in the project were modified
- [ ] `agent-sdd/` folder was never touched
- [ ] Auto-detection accuracy: stack matches actual project (check `project.config.md`)
- [ ] File paths in MODULE_MAP.md point to actual source locations

## Out of Scope

- Do NOT fill in human-authored spec files (`CONVENTIONS.md`, `TESTING.md`, etc.) — leave as templates
- Do NOT create actual task files yet — just set up the folder structure
- Do NOT commit the generated files yet — user reviews first, then commits

## Affected Areas

All project areas (Android, iOS, or both depending on platform detection)

## Testing

Required: N

(This is a setup task, not feature/bug work. No tests apply to scaffold generation.)

## Designs / References

- SDD folder structure: `agent-sdd/README.md` — "Folder Structure" section
- Template files: `agent-sdd/spec-kit/`, `agent-sdd/context/TEMPLATE.md`

## Notes

After this task completes:
1. Review `agent-artifacts/project.config.md` — fix any auto-detected values that are wrong
2. Manually fill in:
   - `agent-artifacts/spec-kit/CONVENTIONS.md` — your coding standards
   - `agent-artifacts/spec-kit/TESTING.md` — your test patterns
   - `agent-artifacts/spec-kit/MIGRATION_RULES.md` — legacy → modern migration rules
   - `agent-artifacts/spec-kit/TECH_DEBT.md` — known debt register
3. Commit `agent-artifacts/` to your project repo alongside source code
4. For each module, run a BOOTSTRAP task to generate `context/<module>.md` files
5. Start executing regular feature/bug tasks with `claude "Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/[TICKET-ID].md"`

---

## Agent Instructions

Follow the workflow below. You have everything needed in this SDD.

### Step 1: Understand the Project

1. Determine if this is an Android or iOS project by checking:
   - Presence of `build.gradle`, `settings.gradle`, `app/` or `Module.swift`, `.xcodeproj/`, `Podfile`
2. Read the relevant platform detection section from `agent-sdd/engine/platform-android.js` or `agent-sdd/engine/platform-ios.js`
3. Scan the project structure to extract:
   - **Android:** Package name, min/target SDK, Gradle modules, dependencies (Compose vs XML, Hilt, Retrofit, Room, RxJava, Coroutines, etc.)
   - **iOS:** Bundle ID, deployment target, SPM/Pods dependencies, UI framework (SwiftUI vs UIKit), async pattern (async/await vs Combine)

### Step 2: Generate project.config.md

Create `agent-artifacts/project.config.md` with:
```markdown
# Project Configuration

**Platform:** Android / iOS
**Primary Language:** Kotlin / Java / Swift / Objective-C
**Build System:** Gradle / Xcode / SPM / CocoaPods
**Min SDK / Deployment Target:** [value]
**Package/Bundle ID:** [value]
**Modules:** [list discovered modules]
**UI Framework:** Compose / XML / SwiftUI / UIKit
**Async Pattern:** Coroutines / RxJava / Async-Await / Combine
**Dependency Injection:** Hilt / Koin / Manual / SwiftDependencies
**Testing Framework:** JUnit / Espresso / XCTest / Quick-Nimble
**Default Tests:** Y / N

[Add other relevant stack info]
```

### Step 3: Generate Spec-Kit AI Artifacts

Create these three files in `agent-artifacts/spec-kit/`:

**ARCHITECTURE.md** (auto-generate from detected structure):
```markdown
# Architecture — [Project Name]

## Module Breakdown
[List modules found in MODULE_MAP with brief purpose]

## Tech Stack
- UI: [Compose/XML/SwiftUI/UIKit]
- State: [Coroutines/RxJava/StateFlow/Combine]
- Network: [Retrofit/Alamofire/URLSession]
- Persistence: [Room/SQLite/CoreData/UserDefaults]
- DI: [Hilt/Koin/Manual]

## Key Patterns
[2-3 architectural patterns observed in the codebase]

## ADRs
(Will be updated as project evolves)
```

**MODULE_MAP.md** (auto-generate from detected modules):
```markdown
# Module Registry

| Module | Path | Type | Purpose |
|--------|------|------|---------|
| [name] | [path] | [library/app] | [brief] |
| ... | ... | ... | ... |
```

**DATA_MODEL.md** (auto-scan for entities/models):
```markdown
# Data Model

## Core Entities
[List main data classes/models found]

## API Contracts
[If API calls found, list main request/response types]

## Database Schema
[If database found, list main tables/collections]
```

### Step 4: Create Empty Spec-Kit Templates

Create these in `agent-artifacts/spec-kit/` (leave as templates for humans to fill):

**CONVENTIONS.md**
```markdown
# Coding Conventions

## Language Standards
[Human to fill: naming conventions, code style, etc.]

## Directory Structure
[Human to fill: where to place files]

## Naming Conventions
[Human to fill: classes, functions, variables, packages]
```

**TESTING.md**
```markdown
# Testing Standards

## Test Patterns
[Human to fill: how to structure tests]

## Coverage Requirements
[Human to fill: minimum coverage %]

## Test Naming
[Human to fill: naming convention for test files and methods]
```

**MIGRATION_RULES.md**
```markdown
# Migration Rules — Legacy → Modern

## When to Apply
[Human to fill: conditions for modern patterns]

## Rules
[Human to fill: specific modernization rules]

## Scope Guard
[Human to fill: what NOT to modernize in this task]
```

**TECH_DEBT.md**
```markdown
# Technical Debt Register

## Known Issues
[Human to fill: list of known debt items with locations]

## Agent Rules
For each item:
- **Status:** Open / Resolved
- **Location:** [file:line or module]
- **Description:** [what's wrong]
- **Agent instruction:** [e.g., "Do not add more LiveData here"]
```

### Step 5: Create Folder Structure

Create these folders (empty):
- `agent-artifacts/context/` — will contain module context files
  - Create `agent-artifacts/context/_index.md` with routing table header:
    ```markdown
    # Context Index — Module Routing Table
    
    | Module | File | Keywords |
    |--------|------|----------|
    | [module name] | [module].md | [keywords, e.g., "auth, login, user"] |
    ```
- `agent-artifacts/tasks/` — will contain task files

### Step 6: Completion

Output a summary:
```
## Done — SETUP: Initialize Agentic SDD

### Files Created
- agent-artifacts/project.config.md
- agent-artifacts/spec-kit/ARCHITECTURE.md
- agent-artifacts/spec-kit/MODULE_MAP.md
- agent-artifacts/spec-kit/DATA_MODEL.md
- agent-artifacts/spec-kit/CONVENTIONS.md (template)
- agent-artifacts/spec-kit/TESTING.md (template)
- agent-artifacts/spec-kit/MIGRATION_RULES.md (template)
- agent-artifacts/spec-kit/TECH_DEBT.md (template)
- agent-artifacts/context/_index.md (empty)
- agent-artifacts/tasks/ (empty)

### Next Steps
1. Review and edit auto-detected values in project.config.md
2. Fill in human-authored specs: CONVENTIONS.md, TESTING.md, MIGRATION_RULES.md, TECH_DEBT.md
3. Commit agent-artifacts/ to your repo
4. Run BOOTSTRAP tasks for each module to generate context/ files
5. Start executing feature/bug tasks

### Quality Gate
- [x] All files created
- [x] No source code modified
- [x] agent-sdd/ untouched
- [x] Folder structure matches SDD spec
```
