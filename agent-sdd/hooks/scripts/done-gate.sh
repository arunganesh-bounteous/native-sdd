#!/usr/bin/env bash
# Stop hook — runs when the agent finishes its turn.
# Checks that the agent didn't sneak edits into protected files.

VIOLATIONS=()

if git rev-parse --git-dir &>/dev/null; then
  MODIFIED=$(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null)

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      agent-artifacts/CLAUDE.md)
        VIOLATIONS+=("PROTECTED (read-only snapshot): $f") ;;
      agent-artifacts/spec-kit/ARCHITECTURE.md|\
      agent-artifacts/spec-kit/MODULE_MAP.md|\
      agent-artifacts/spec-kit/DATA_MODEL.md)
        VIOLATIONS+=("PROTECTED (AI artifact — re-run wizard): $f") ;;
    esac
  done <<< "$MODIFIED"
fi

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  Done-gate warning: the agent modified protected files."
  echo "   These changes should NOT be committed. Review and revert if unintended:"
  for v in "${VIOLATIONS[@]}"; do
    echo "   • $v"
  done
  echo ""
  echo "   Reminder:"
  echo "   • agent-artifacts/CLAUDE.md → re-run the setup wizard to update"
  echo "   • spec-kit/ARCHITECTURE.md, MODULE_MAP.md, DATA_MODEL.md → regenerate via wizard step"
  echo ""
fi

exit 0
