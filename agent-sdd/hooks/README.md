# Claude Code Hooks — Setup Guide

These hook templates enforce the SDD skeleton's protection rules at the **Claude Code runtime level** — before the agent writes a single line.

## What's included

| File | Hook type | What it does |
|------|-----------|-------------|
| `settings.json` | `permissions.deny` + all hooks | Master settings file — copy to `.claude/settings.json` |
| `scripts/protected-paths.sh` | PreToolUse | Blocks writes to generated/tool files |
| `scripts/lint-gate.sh` | PostToolUse | Runs ktlint (Android) or SwiftLint (iOS) after edits |
| `scripts/done-gate.sh` | Stop | Warns if protected spec-kit files were touched |

## Setup (one-time per project)

1. **Create the `.claude/` directory** at your project root (same level as `agent-sdd/`):
   ```bash
   mkdir -p .claude/scripts
   ```

2. **Copy the settings file**:
   ```bash
   cp agent-sdd/hooks/settings.json .claude/settings.json
   ```

3. **Copy the hook scripts**:
   ```bash
   cp agent-sdd/hooks/scripts/*.sh .claude/scripts/
   chmod +x .claude/scripts/*.sh
   ```

4. **Commit** `.claude/` to your project repo so the whole team gets the hooks.

## How each hook works

### `permissions.deny` (zero runtime cost)
Declared in `settings.json` — Claude Code enforces these before any tool runs. No script overhead.

Blocks writes to:
- `agent-sdd/**` — the SDD tool itself (treat as a read-only submodule)
- `agent-artifacts/spec-kit/**` — wizard-generated AI artifacts and human specs
- `*.xcodeproj/**`, `*.xcworkspace/**` — Xcode project files
- `BuildConfig.java`, `R.java`, `*.generated.kt` — Android auto-generated files
- `gradlew`, `gradlew.bat` — Gradle wrapper scripts
- `build/**` — build output directories

### `protected-paths.sh` (PreToolUse)
Runs before every Write/Edit/MultiEdit. Secondary check for paths not covered by glob patterns (e.g., paths with extra nesting). Returns a `permissionDecision: "deny"` JSON response to block the tool call.

### `lint-gate.sh` (PostToolUse)
Runs after every Write/Edit/MultiEdit on source files. Auto-detects platform:
- **Android**: runs `ktlint` (or `./gradlew ktlintCheck`) on `.kt` files
- **iOS**: runs `swiftlint lint` on `.swift` files
- **Other**: passes silently

Set `export PLATFORM=android|ios|none` to override auto-detection.

> If `ktlint` or `swiftlint` is not installed, the hook passes silently — it never blocks work on teams that haven't set up linters yet.

### `done-gate.sh` (Stop)
Runs when Claude finishes its turn. Checks `git diff` for any accidental edits to protected files and prints a warning. Always exits 0 so Claude can still deliver its completion report.

## Customizing

**Add more deny rules** — edit `.claude/settings.json` and add glob patterns to `permissions.deny`. Format: `"Write(path/glob/**)"` or `"Edit(path/glob/**)"`.

**Change lint behavior** — edit `.claude/scripts/lint-gate.sh`. You can swap ktlint for detekt, add Checkstyle, run unit tests, etc.

**Disable a hook** — remove its entry from `.claude/settings.json`.

## Enforcement hierarchy

```
permissions.deny     ← fastest, zero cost, enforced by Claude Code itself
protected-paths.sh   ← script-level catch for edge cases
lint-gate.sh         ← code quality gate
done-gate.sh         ← final audit / warning
CLAUDE.md            ← soft context (agent reads and follows)
```

`permissions.deny` is the strongest layer — it fires before the agent even attempts the tool call. CLAUDE.md is the weakest — it relies on the model following instructions. Both layers working together give you defense in depth.
