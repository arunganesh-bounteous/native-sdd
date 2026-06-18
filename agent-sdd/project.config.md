# Project Configuration
# ─────────────────────────────────────────────────────────────────────────────
# Edit this file once when adopting this skeleton for a new project.
# Every Claude session reads this file first (Step 0 of CLAUDE.md protocol).
# ─────────────────────────────────────────────────────────────────────────────

## Codebase

codebase_path: ..
# All file paths in context/*.md are resolved relative to this path.

## Platform

platform: Android
# Options: Android | iOS | Web | Backend | Flutter | React Native

primary_language: Kotlin
# Options: Kotlin | Java | Swift | TypeScript | JavaScript | Dart | Python | etc.

## Android-specific (remove section if not Android)

package_name: com.example.myapp
# Base source package — matches source directory structure.
# applicationId varies by build variant:
#   development:  com.example.app.development
# Use the base package_name above for all file path and import generation.
min_sdk: 24
target_sdk: 36

## Team Preferences

default_tests: N
# Y = Claude always writes tests unless the task MD explicitly says N.
# N = Claude asks each time.

branch_convention: feature/[PROJ]-XXXX
# Naming hint shown in task completion reports.
# Example: feature/[PROJ]-1234 | bugfix/[PROJ]-1234 | chore/[PROJ]-1234
