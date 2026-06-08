#!/usr/bin/env bash
# PreToolUse hook — blocks git write operations.
#
# The agent must never commit, push, stage, or alter git history.
# All git decisions are reserved for the human developer.
# This is a backup to the permissions.deny rules in settings.json.
#
# Exit 0 + JSON deny = block the command.
# Exit 0 + no output = allow through.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('command', ''))
except Exception:
    print('')
" 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

deny() {
  local reason="$1"
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"'"$reason"'"}}'
  exit 0
}

# Normalize: collapse whitespace, strip leading spaces
CMD=$(echo "$COMMAND" | tr -s ' \t' ' ' | sed 's/^ //')

# ── Block git write operations ────────────────────────────────────────────────
case "$CMD" in
  git\ commit*)
    deny "git commit is not allowed — the agent must never create commits. Stage and commit changes yourself after reviewing." ;;
  git\ push*)
    deny "git push is not allowed — the agent must never push to a remote. Push changes yourself after reviewing." ;;
  git\ add*)
    deny "git add is not allowed — staging is part of the commit workflow. Stage changes yourself after reviewing the agent's work." ;;
  git\ merge*)
    deny "git merge is not allowed — branch merges are a human decision." ;;
  git\ rebase*)
    deny "git rebase is not allowed — history rewriting is a human decision." ;;
  git\ tag*)
    deny "git tag is not allowed — tagging releases is a human decision." ;;
  git\ reset\ --hard*)
    deny "git reset --hard is not allowed — this would discard uncommitted changes permanently." ;;
  git\ clean*)
    deny "git clean is not allowed — this would delete untracked files permanently." ;;
esac

exit 0
