#!/bin/bash
# Claude Scout — Installer
# Copies all files to ~/.claude/ and registers hooks in settings.json

set -e

CLAUDE_DIR="$HOME/.claude"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Claude Scout..."

# Create directories
mkdir -p "$CLAUDE_DIR/scripts"
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/skills/session-scout"

# Copy files
cp "$SCRIPT_DIR/scripts/build-skill-catalog.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/project-detector.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/hooks/scout-session-start.js" "$CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/hooks/advisor-post-tool-use.js" "$CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/skills/session-scout/SKILL.md" "$CLAUDE_DIR/skills/session-scout/"
cp "$SCRIPT_DIR/skills/session-scout/GUIDE.md" "$CLAUDE_DIR/skills/session-scout/"

echo "Files copied to $CLAUDE_DIR"

# Build initial catalog
echo "Building skill catalog..."
node "$CLAUDE_DIR/scripts/build-skill-catalog.js"

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Add the hooks to ~/.claude/settings.json (see README.md)"
echo "  2. Restart Claude Code"
echo ""
echo "Commands available after restart:"
echo "  /scout           — Scan project and show toolkit recommendations"
echo "  /scout:eval      — Mid-session evaluation"
echo "  /scout:bootstrap — Deep analysis for new projects"
echo "  /scout:help      — Show user guide"
