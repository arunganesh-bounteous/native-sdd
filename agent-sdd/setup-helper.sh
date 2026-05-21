#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# setup-helper.sh — Complete SDD Setup
# ═══════════════════════════════════════════════════════════════════════════════
#
# Run this script from your project root after completing the setup wizard.
# It will copy CLAUDE.md to agent-artifacts/ and make it read-only.
#
# Usage:
#   bash agent-sdd/setup-helper.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENT_ARTIFACTS="$PROJECT_ROOT/agent-artifacts"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Agentic SDD Setup Helper${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if we're in a project with agent-sdd
if [ ! -d "$SCRIPT_DIR" ]; then
  echo -e "${RED}❌ Error: Cannot find agent-sdd folder${NC}"
  echo "   Run this script from project root: bash agent-sdd/setup-helper.sh"
  exit 1
fi

# Check if agent-artifacts exists
if [ ! -d "$AGENT_ARTIFACTS" ]; then
  echo -e "${RED}❌ Error: agent-artifacts/ folder not found${NC}"
  echo "   Please run the setup wizard first:"
  echo "   open agent-sdd/setup-wizard.html"
  exit 1
fi

# Check if CLAUDE.md already exists in agent-artifacts
if [ -f "$AGENT_ARTIFACTS/CLAUDE.md" ]; then
  echo -e "${GREEN}✅ agent-artifacts/CLAUDE.md already exists${NC}"
  echo ""
  echo "Setup is complete! You can now run tasks:"
  echo ""
  echo "  claude \"Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md\""
  echo ""
  exit 0
fi

# Copy CLAUDE.md
echo -e "📋 Copying CLAUDE.md from agent-sdd/ to agent-artifacts/..."
cp "$SCRIPT_DIR/CLAUDE.md" "$AGENT_ARTIFACTS/CLAUDE.md"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ CLAUDE.md copied successfully${NC}"
else
  echo -e "${RED}❌ Failed to copy CLAUDE.md${NC}"
  exit 1
fi

# Check if git is available
if command -v git &> /dev/null; then
  cd "$PROJECT_ROOT"

  # Check git status
  if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "📝 Staging CLAUDE.md for git..."
    git add agent-artifacts/CLAUDE.md

    # Check if there are staged changes
    if git diff --cached --quiet agent-artifacts/CLAUDE.md; then
      echo -e "${YELLOW}⚠️  No changes to commit (file may already be tracked)${NC}"
    else
      echo -e "${GREEN}✅ CLAUDE.md staged${NC}"
      echo ""
      echo "Review changes and commit:"
      echo "  git commit -m \"Add CLAUDE.md to agent-artifacts (read-only snapshot)\""
    fi
  else
    echo -e "${YELLOW}⚠️  Not a git repository (skipping git commands)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Git not found (skipping git staging)${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "You can now run tasks from your project terminal:"
echo ""
echo "  cd /path/to/your/project"
echo "  claude \"Read agent-artifacts/CLAUDE.md and execute agent-artifacts/tasks/PROJ-1234.md\""
echo ""
echo "📚 Documentation:"
echo "  • CLI workflow: agent-sdd/CLI_SETUP.md"
echo "  • Architecture: agent-sdd/ARCHITECTURE_DECISION.md"
echo ""
