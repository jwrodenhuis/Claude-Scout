# Claude Scout

Intelligent toolkit advisor for Claude Code. Automatically recommends the right skills, agents, hooks, and MCP servers based on your project context.

## What it does

- **Session Scout** — At session start, analyzes your project (language, framework, dependencies) and recommends the most relevant tools from your entire Claude Code toolkit
- **Action Advisor** — During work, suggests skills and agents when it detects patterns in your actions (e.g., writing tests, editing API routes, database queries). Supports multi-pattern matching for overlapping contexts
- **Project Memory** — Remembers your tool choices and usage per project across sessions
- **Auto-Discovery** — Automatically detects newly installed skills, plugins, hooks, and MCP servers

## Features

| Feature | Description |
|---------|-------------|
| `/scout` | Full project scan with toolkit recommendations |
| `/scout:eval` | Mid-session evaluation — compares initial advice with actual usage |
| `/scout:bootstrap` | Deep analysis for projects new to the scout methodology |
| `/scout:help` | Show the user guide |
| Action Advisor | Real-time multi-pattern suggestions with What/Why/How format |
| Project Memory | Persistent `.claude/scout-profile.json` per project |
| Health Check | `npm run health-check` to verify installation |
| Auto-rebuild | Catalog rebuilds when new tools are detected |

## Installation

### Automated (recommended)

```bash
git clone https://github.com/jwrodenhuis/Claude-Scout.git
cd Claude-Scout
./install.sh
```

This copies all files to `~/.claude/`, registers hooks in `settings.json`, and builds the initial catalog.

### Verify installation

```bash
./install.sh --check
# or after npm install:
npm run health-check
```

### Uninstall

```bash
./install.sh --uninstall
```

## How it works

### Catalog Builder (`scripts/build-skill-catalog.js`)

Scans all your Claude Code tooling and builds an indexed JSON file:
- `~/.claude/skills/` — All installed skills
- `~/.claude/agents/` — All agents
- `~/.claude/plugins/cache/` — Plugin skills
- `~/.claude/get-shit-done/workflows/` — GSD commands
- `~/.claude/settings.json` — Hooks, plugins
- `.mcp.json` — MCP server metadata with tag inference

Output: `~/.claude/skills/.index.json` (380+ entries with tier classification: core, universal, niche)

### Project Detector (`scripts/project-detector.js`)

Detects project type from config files:
- `package.json` — JS/TS, framework (Next.js, React, Vue, Angular, SvelteKit, Express, Hono), test runner, database ORM
- `pyproject.toml` / `requirements.txt` — Python, framework (Django, FastAPI, Flask), SQLAlchemy
- `Cargo.toml` — Rust (Actix, Axum, Tokio)
- `go.mod` — Go (Gin, Echo, Fiber)
- `Gemfile` — Ruby/Rails
- `pom.xml` / `build.gradle` — Java/Spring
- `Package.swift` — Swift
- `angular.json` — Angular
- Monorepo detection (workspaces, pnpm-workspace.yaml, lerna.json)
- Docker, CI/CD detection

### Scoring Algorithm

Each tool in the catalog is scored against your project:

| Signal | Score |
|--------|-------|
| Language match | +10 |
| Framework match | +15 |
| Dependency match | +8 |
| Domain relevance | +5 |
| Historical usage | +2 per use (max +10) |

Skills are classified into tiers:
- **Core** — Language/framework-specific, require language match
- **Universal** — Git, planning, refactoring tools, always eligible
- **Niche** — Scientific/domain-specific, require both language and domain match

### Session Scout Hook (`hooks/scout-session-start.js`)

Runs at session start:
1. Checks if catalog needs rebuild (fingerprint comparison)
2. Detects project type
3. Loads existing project profile (with validation)
4. Scores and ranks tools with tier-aware algorithm
5. Emits top 10 toolkit briefing via `additionalContext`
6. Saves project profile

### Action Advisor Hook (`hooks/advisor-post-tool-use.js`)

Runs after Edit/Write/Bash:
1. Tracks Skill tool invocations for eval metrics
2. Analyzes action patterns (file paths, content, output)
3. Returns up to 2 matches for overlapping patterns (e.g., API + security)
4. Per-pattern debounce (max 1 suggestion per 2 min, no repeats per pattern within 10 min)
5. Emits suggestion with What/Why now/How to use format
6. Stores session state in `{project}/.claude/scout-session-state.json`

Detected patterns: testing, API, database, security, frontend, Docker, build errors, git workflow, data science.

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

## Development

```bash
npm install          # Install dev dependencies (vitest only)
npm test             # Run all tests (110 tests)
npx vitest --watch   # Watch mode
npm run health-check # Verify installation
```

## File structure

```
Claude-Scout/
├── README.md
├── CLAUDE.md                          # Project conventions
├── package.json
├── vitest.config.js
├── install.sh                         # Installer (--check, --uninstall)
├── scripts/
│   ├── build-skill-catalog.js         # Catalog builder with tier classification
│   ├── project-detector.js            # Project type detection
│   ├── manage-hooks.js                # Hook registration in settings.json
│   └── health-check.js               # Installation health verification
├── hooks/
│   ├── scout-session-start.js         # SessionStart hook
│   └── advisor-post-tool-use.js       # PostToolUse hook (multi-pattern)
├── skills/
│   ├── session-scout/
│   │   ├── SKILL.md                   # /scout skill definition
│   │   └── GUIDE.md                   # User guide
│   ├── scout:eval/SKILL.md            # /scout:eval command
│   ├── scout:bootstrap/SKILL.md       # /scout:bootstrap command
│   └── scout:help/SKILL.md            # /scout:help command
└── tests/                             # Vitest tests (110 tests)
    ├── fixtures/                      # Mock project configs (17 project types)
    ├── project-detector.test.js
    ├── build-skill-catalog.test.js
    ├── scout-session-start.test.js
    ├── advisor-post-tool-use.test.js
    ├── manage-hooks.test.js
    └── health-check.test.js
```

## License

MIT
