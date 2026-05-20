#!/usr/bin/env bash
# PostToolUse hook — runs a fast lint check after the agent edits a source file.
# Only fires on Write/Edit/MultiEdit. Non-zero exit blocks the agent from continuing.
# Customize the PLATFORM variable or add detection logic for your project.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('file_path', '') or
          data.get('tool_input', {}).get('path', ''))
except Exception:
    print('')
" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# ── Platform auto-detection ────────────────────────────────────────────────────
# Override by setting PLATFORM env var: export PLATFORM=android | ios | none
if [ -z "$PLATFORM" ]; then
  if [ -f "gradlew" ] || find . -maxdepth 3 -name "*.gradle" -o -name "*.gradle.kts" 2>/dev/null | grep -q .; then
    PLATFORM="android"
  elif find . -maxdepth 3 -name "*.xcodeproj" -type d 2>/dev/null | grep -q .; then
    PLATFORM="ios"
  else
    PLATFORM="none"
  fi
fi

# ── Android: ktlint on Kotlin files ───────────────────────────────────────────
if [[ "$PLATFORM" == "android" && "$FILE_PATH" == *.kt ]]; then
  # Use ktlint if available, otherwise try gradlew ktlintCheck on the specific module
  if command -v ktlint &>/dev/null; then
    ktlint --editorconfig=".editorconfig" "$FILE_PATH" 2>&1
    STATUS=$?
    if [ $STATUS -ne 0 ]; then
      echo "❌ ktlint failed on $FILE_PATH — fix the formatting issues above before continuing." >&2
      exit $STATUS
    fi
  elif [ -f "gradlew" ]; then
    # Derive Gradle module path from file path (best-effort)
    MODULE=$(echo "$FILE_PATH" | sed 's|/src/.*||' | sed 's|^\./||' | sed 's|/|:|g')
    ./gradlew ":${MODULE}:ktlintCheck" --quiet 2>&1 | tail -20
    STATUS=${PIPESTATUS[0]}
    if [ $STATUS -ne 0 ]; then
      echo "❌ ktlint check failed — run './gradlew ktlintFormat' to auto-fix." >&2
      exit $STATUS
    fi
  fi
fi

# ── iOS: swiftlint on Swift files ─────────────────────────────────────────────
if [[ "$PLATFORM" == "ios" && "$FILE_PATH" == *.swift ]]; then
  if command -v swiftlint &>/dev/null; then
    swiftlint lint --quiet --path "$FILE_PATH" 2>&1
    STATUS=$?
    if [ $STATUS -ne 0 ]; then
      echo "❌ SwiftLint failed on $FILE_PATH — fix the violations above before continuing." >&2
      exit $STATUS
    fi
  fi
  # swiftlint not installed → pass silently (don't block)
fi

exit 0
