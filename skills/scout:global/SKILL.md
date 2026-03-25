---
name: "scout:global"
description: "Scans all projects in the configured projects directory and writes globally-relevant tools to ~/.claude/CLAUDE.md."
---

# Scout Global — Cross-project tool aggregation

Scans all projects in the configured projects directory, aggregates which tools are
relevant across most projects, and writes them to `~/.claude/CLAUDE.md` so they are
available in every session.

## Steps:

1. **Run global scout:**
   ```bash
   node ~/.claude/scripts/global-scout.js
   ```
   This will scan all projects in the configured `projectsDir` (default: `~/projects`),
   score each tool against each project, and determine which tools qualify as globally
   relevant based on the threshold settings.

2. **Display results to the user:**
   Show how many projects were scanned and which tools were found globally relevant,
   grouped by type (skills, agents, MCP servers).

3. **Report what was written to `~/.claude/CLAUDE.md`:**
   Confirm the global section was updated with the `<!-- scout:global:start/end -->` markers.

4. **Show MCP server suggestions (do NOT auto-install):**
   If any MCP servers appear in the global candidates, list them with install commands
   but explicitly ask the user for confirmation before writing to `~/.claude/settings.json`.

5. **Offer to update config if needed:**
   If the user wants to change `projectsDir`, `globalThreshold`, or `minProjects`,
   update `~/.claude/scout-config.json` and re-run.

## Configuration

Config is stored at `~/.claude/scout-config.json`:
```json
{
  "projectsDir": "~/projects",
  "globalThreshold": 0.4,
  "minProjects": 2
}
```

- `projectsDir` — Directory containing all projects to scan (supports `~` expansion)
- `globalThreshold` — Fraction of projects where a tool must be relevant (default: 40%)
- `minProjects` — Minimum number of projects for a tool to qualify regardless of threshold

## Output format:

```
Global Scout — [N] projects scanned
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found [X] globally relevant tools (threshold: 40%):

Skills:
  /skill-name — relevant in [N]/[total] projects (avg score: [S])

Agents:
  agent-name — relevant in [N]/[total] projects (avg score: [S])

MCP servers (not yet installed):
  server-name — [description]
  → To install: add to ~/.claude/settings.json

Global section written to ~/.claude/CLAUDE.md
```

## Important rules:
- Do NOT auto-write MCP servers to settings.json — always ask for user confirmation first
- Use `node ~/.claude/scripts/global-scout.js` — do not duplicate aggregation logic
- The global profile is saved to `~/.claude/scout-global-profile.json`
- If `projectsDir` is not set or contains no recognized projects, tell the user and
  offer to configure it
