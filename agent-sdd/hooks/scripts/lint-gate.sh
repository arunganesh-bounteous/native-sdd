#!/usr/bin/env bash
# PostToolUse hook — runs a fast lint check after the agent edits a source file.

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

if [ -z "$PLATFORM" ]; then
  if [ -f "gradlew" ] || find . -maxdepth 3 -name "*.gradle" -o -name "*.gradle.kts" 2>/dev/null | grep -q .; then
    PLATFORM="android"
  elif find . -maxdepth 3 -name "*.xcodeproj" -type d 2>/dev/null | grep -q .; then
    PLATFORM="ios"
  else
    PLATFORM="none"
  fi
fi

if [[ "$PLATFORM" == "android" && "$FILE_PATH" == *.kt ]]; then
  if command -v ktlint &>/dev/null; then
    ktlint --editorconfig=".editorconfig" "$FILE_PATH" 2>&1
    STATUS=$?
    if [ $STATUS -ne 0 ]; then
      echo "❌ ktlint failed on $FILE_PATH — fix the formatting issues above before continuing." >&2
      exit $STATUS
    fi
  elif [ -f "gradlew" ]; then
    MODULE=$(echo "$FILE_PATH" | sed 's|/src/.*||' | sed 's|^\./||' | sed 's|/|:|g')
    ./gradlew ":$\{MODULE\}:ktlintCheck" --quiet 2>&1 | tail -20
    STATUS=${PIPESTATUS[0]}
    if [ $STATUS -ne 0 ]; then
      echo "❌ ktlint check failed — run './gradlew ktlintFormat' to auto-fix." >&2
      exit $STATUS
    fi
  fi
fi

if [[ "$PLATFORM" == "ios" && "$FILE_PATH" == *.swift ]]; then
  if command -v swiftlint &>/dev/null; then
    swiftlint lint --quiet --path "$FILE_PATH" 2>&1
    STATUS=$?
    if [ $STATUS -ne 0 ]; then
      echo "❌ SwiftLint failed on $FILE_PATH — fix the violations above before continuing." >&2
      exit $STATUS
    fi
  fi
fi

exit 0
