#!/bin/bash
# Claude Scout — Installer
# Copies all files to ~/.claude/ and registers hooks in settings.json
# Usage: ./install.sh [--uninstall] [--check]

set -e

CLAUDE_DIR="$HOME/.claude"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check Node.js availability
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required but not found. Install it from https://nodejs.org/" >&2
  exit 1
fi

# Uninstall mode
if [ "$1" = "--uninstall" ]; then
  echo "Uninstalling Claude Scout..."
  node "$SCRIPT_DIR/scripts/manage-hooks.js" uninstall 2>&1
  rm -f "$CLAUDE_DIR/scripts/build-skill-catalog.js"
  rm -f "$CLAUDE_DIR/scripts/project-detector.js"
  rm -f "$CLAUDE_DIR/scripts/manage-hooks.js"
  rm -f "$CLAUDE_DIR/scripts/global-scout.js"
  rm -f "$CLAUDE_DIR/scripts/online-search.js"
  rm -f "$CLAUDE_DIR/scripts/i18n.js"
  rm -f "$CLAUDE_DIR/hooks/scout-session-start.js"
  rm -f "$CLAUDE_DIR/hooks/advisor-post-tool-use.js"
  rm -rf "$CLAUDE_DIR/skills/session-scout"
  rm -rf "$CLAUDE_DIR/skills/scout:global"
  echo "Claude Scout uninstalled."
  exit 0
fi

# Check mode
if [ "$1" = "--check" ]; then
  echo "Checking Claude Scout installation..."
  ERRORS=0
  for f in scripts/build-skill-catalog.js scripts/project-detector.js scripts/manage-hooks.js scripts/global-scout.js scripts/online-search.js scripts/i18n.js hooks/scout-session-start.js hooks/advisor-post-tool-use.js skills/session-scout/SKILL.md skills/scout:global/SKILL.md; do
    if [ -f "$CLAUDE_DIR/$f" ]; then
      echo "  OK: $f"
    else
      echo "  MISSING: $f" >&2
      ERRORS=$((ERRORS + 1))
    fi
  done
  if [ $ERRORS -gt 0 ]; then
    echo "Found $ERRORS missing files. Run ./install.sh to fix." >&2
    exit 1
  fi
  echo "All files present."
  exit 0
fi

echo "Installing Claude Scout..."

# Create directories
mkdir -p "$CLAUDE_DIR/scripts"
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/skills/session-scout"
mkdir -p "$CLAUDE_DIR/skills/scout:eval"
mkdir -p "$CLAUDE_DIR/skills/scout:bootstrap"
mkdir -p "$CLAUDE_DIR/skills/scout:help"
mkdir -p "$CLAUDE_DIR/skills/scout:global"

# Copy files
cp "$SCRIPT_DIR/scripts/build-skill-catalog.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/project-detector.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/manage-hooks.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/global-scout.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/online-search.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/i18n.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/hooks/scout-session-start.js" "$CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/hooks/advisor-post-tool-use.js" "$CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/skills/session-scout/SKILL.md" "$CLAUDE_DIR/skills/session-scout/"
cp "$SCRIPT_DIR/skills/session-scout/GUIDE.md" "$CLAUDE_DIR/skills/session-scout/"
cp "$SCRIPT_DIR/skills/scout:eval/SKILL.md" "$CLAUDE_DIR/skills/scout:eval/"
cp "$SCRIPT_DIR/skills/scout:bootstrap/SKILL.md" "$CLAUDE_DIR/skills/scout:bootstrap/"
cp "$SCRIPT_DIR/skills/scout:help/SKILL.md" "$CLAUDE_DIR/skills/scout:help/"
cp "$SCRIPT_DIR/skills/scout:global/SKILL.md" "$CLAUDE_DIR/skills/scout:global/"

echo "Files copied to $CLAUDE_DIR"

# Register hooks in settings.json
echo "Registering hooks..."
RESULT=$(node "$SCRIPT_DIR/scripts/manage-hooks.js" install 2>&1)
echo "  $RESULT"

# Build initial catalog
echo "Building skill catalog..."
node "$CLAUDE_DIR/scripts/build-skill-catalog.js"

echo ""
echo "Installation complete! Restart Claude Code to activate."
echo ""
echo "Commands available after restart:"
echo "  /scout           — Scan project and show toolkit recommendations"
echo "  /scout:global    — Scan all projects and write globally-relevant tools to ~/.claude/CLAUDE.md"
echo "  /scout:eval      — Mid-session evaluation"
echo "  /scout:bootstrap — Deep analysis for new projects"
echo "  /scout:help      — Show user guide"
echo ""
echo "Verify: ./install.sh --check"
echo "Remove: ./install.sh --uninstall"
