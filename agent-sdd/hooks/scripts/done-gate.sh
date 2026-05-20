#!/usr/bin/env bash
# Stop hook — runs when the agent finishes its turn.
# Checks that the agent didn't sneak edits into protected spec-kit files.
# Non-zero exit prints a warning; exit 0 always so Claude can still respond.

VIOLATIONS=()

# ── Check for uncommitted edits to spec-kit (AI artifacts must never be hand-edited) ──
if git rev-parse --git-dir &>/dev/null; then
  MODIFIED=$(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null)

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      agent-sdd/*)
        VIOLATIONS+=("PROTECTED (tool): $f") ;;
      agent-sdd-output/spec-kit/ARCHITECTURE.md|\
      agent-sdd-output/spec-kit/MODULE_MAP.md|\
      agent-sdd-output/spec-kit/DATA_MODEL.md)
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
  echo "   • agent-sdd/ files → re-run the SDD wizard to update"
  echo "   • spec-kit/ARCHITECTURE.md, MODULE_MAP.md, DATA_MODEL.md → regenerate via wizard step"
  echo ""
fi

# Always exit 0 so Claude can still deliver its completion report.
exit 0
