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

# Extract every `git ...` fragment from the command.
# Handles compound commands:  cd app && git commit
#           -C flag:           git -C subdir commit
#           sh -c wrappers:    sh -c "git push"
# Each fragment is the text from 'git' up to the next shell separator (;|&).
while IFS= read -r gitfrag; do
  [ -z "$gitfrag" ] && continue

  # Find the git subcommand by skipping past any flag/value pairs (-C dir, --git-dir=x, etc.)
  args=$(echo "$gitfrag" | sed 's/^\s*git\s*//')
  subverb=""
  for word in $args; do
    case "$word" in
      -*) continue ;;     # skip flags
      *) subverb="$word"; break ;;
    esac
  done

  case "$subverb" in
    commit)
      deny "git commit is not allowed — the agent must never create commits. Stage and commit changes yourself after reviewing." ;;
    push)
      deny "git push is not allowed — the agent must never push to a remote. Push changes yourself after reviewing." ;;
    add)
      deny "git add is not allowed — staging is part of the commit workflow. Stage changes yourself after reviewing the agent's work." ;;
    merge)
      deny "git merge is not allowed — branch merges are a human decision." ;;
    rebase)
      deny "git rebase is not allowed — history rewriting is a human decision." ;;
    tag)
      deny "git tag is not allowed — tagging releases is a human decision." ;;
    reset)
      if echo "$args" | grep -q '\-\-hard'; then
        deny "git reset --hard is not allowed — this would discard uncommitted changes permanently."
      fi ;;
    clean)
      deny "git clean is not allowed — this would delete untracked files permanently." ;;
  esac
done < <(echo "$COMMAND" | grep -oE '\bgit\b[^;|&"]*')

exit 0
