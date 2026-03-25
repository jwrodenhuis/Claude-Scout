# Claude Scout

Intelligent toolkit advisor for Claude Code. Automatically recommends the right skills, agents, hooks, and MCP servers based on your project context.

## What it does

- **Session Scout** — At session start, analyzes your project (language, framework, dependencies) and recommends the most relevant tools from your entire Claude Code toolkit
- **Action Advisor** — During work, suggests skills and agents when it detects patterns in your actions (e.g., writing tests, editing API routes, database queries)
- **Project Memory** — Remembers your tool choices and usage per project across sessions
- **Auto-Discovery** — Automatically detects newly installed skills, plugins, hooks, and MCP servers

## Features

| Feature | Description |
|---------|-------------|
| `/scout` | Full project scan with toolkit recommendations |
| `/scout:eval` | Mid-session evaluation — compares initial advice with actual usage |
| `/scout:bootstrap` | Deep analysis for projects new to the scout methodology |
| `/scout:help` | Show the user guide |
| Action Advisor | Real-time suggestions with What/Why/How format |
| Project Memory | Persistent `.claude/scout-profile.json` per project |
| Auto-rebuild | Catalog rebuilds when new tools are detected |

## Installation

### 1. Copy files to your Claude Code config

```bash
# Scripts (shared modules)
cp scripts/build-skill-catalog.js ~/.claude/scripts/
cp scripts/project-detector.js ~/.claude/scripts/

# Hooks
cp hooks/scout-session-start.js ~/.claude/hooks/
cp hooks/advisor-post-tool-use.js ~/.claude/hooks/

# Skill
mkdir -p ~/.claude/skills/session-scout
cp skills/session-scout/SKILL.md ~/.claude/skills/session-scout/
cp skills/session-scout/GUIDE.md ~/.claude/skills/session-scout/
```

### 2. Register hooks in `~/.claude/settings.json`

Add the Session Scout hook to `SessionStart`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "node \"~/.claude/hooks/scout-session-start.js\"",
          "timeout": 3
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|Bash",
        "hooks": [{
          "type": "command",
          "command": "node \"~/.claude/hooks/advisor-post-tool-use.js\"",
          "timeout": 1
        }]
      }
    ]
  }
}
```

### 3. Build the initial catalog

```bash
node ~/.claude/scripts/build-skill-catalog.js
```

### 4. Restart Claude Code

The scout will automatically run at the next session start.

## How it works

### Catalog Builder (`scripts/build-skill-catalog.js`)

Scans all your Claude Code tooling and builds an indexed JSON file:
- `~/.claude/skills/` — All installed skills
- `~/.claude/agents/` — All agents
- `~/.claude/plugins/cache/` — Plugin skills
- `~/.claude/get-shit-done/workflows/` — GSD commands
- `~/.claude/settings.json` — Hooks, plugins, MCP servers

Output: `~/.claude/skills/.index.json` (~30KB, 377+ entries)

### Project Detector (`scripts/project-detector.js`)

Detects project type from config files:
- `package.json` → JS/TS, framework, dependencies, test runner
- `pyproject.toml` → Python, framework
- `Cargo.toml` → Rust
- `go.mod` → Go
- `Gemfile` → Ruby/Rails
- Docker, CI/CD detection

### Session Scout Hook (`hooks/scout-session-start.js`)

Runs at session start:
1. Checks if catalog needs rebuild (fingerprint comparison)
2. Detects project type
3. Loads existing project profile (if any)
4. Scores and ranks tools against project
5. Emits toolkit briefing via `additionalContext`
6. Saves project profile

### Action Advisor Hook (`hooks/advisor-post-tool-use.js`)

Runs after Edit/Write/Bash:
1. Analyzes action patterns (file paths, content, output)
2. Matches against known patterns (testing, API, database, security, frontend, etc.)
3. Debounces (max 1 suggestion per 2 min, no repeats within 10 min)
4. Emits suggestion with What/Why now/How to use format
5. Tracks actions for `/scout:eval`

## Project Memory

Per project, a profile is saved at `{project}/.claude/scout-profile.json`:

```json
{
  "projectType": { "language": "typescript", "framework": "next", "database": "postgresql" },
  "recommendedTools": [{ "name": "/ecc:tdd-workflow", "type": "skill" }],
  "usedTools": [{ "name": "/ecc:tdd-workflow", "count": 3 }],
  "evaluations": [{ "date": "2026-03-25", "score": 7 }],
  "lastSession": "2026-03-25T14:30:00Z"
}
```

Frequently used tools get a higher score in future sessions (learning effect).

## File structure

```
Claude-Scout/
├── README.md
├── install.sh
├── scripts/
│   ├── build-skill-catalog.js    # Catalog builder
│   └── project-detector.js       # Project type detection
├── hooks/
│   ├── scout-session-start.js    # SessionStart hook
│   └── advisor-post-tool-use.js  # PostToolUse hook
└── skills/
    └── session-scout/
        ├── SKILL.md              # /scout skill definition
        └── GUIDE.md              # User guide
```

## License

MIT
