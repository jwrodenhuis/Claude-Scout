# Claude Scout

Intelligent toolkit advisor for Claude Code. Automatically recommends the right skills, agents, hooks, and MCP servers based on your project context.

## What it does

- **Session Scout** — At session start, analyzes your project (language, framework, dependencies) and recommends the most relevant tools from your entire Claude Code toolkit
- **Global Scout** — Scans all your projects to find tools that are useful everywhere, and writes them once to `~/.claude/CLAUDE.md` so they're always available
- **Action Advisor** — During work, suggests skills and agents when it detects patterns in your actions (e.g., writing tests, editing API routes, database queries). Supports multi-pattern matching for overlapping contexts
- **Online Search** — Discovers MCP servers from npm and Glama registries that are relevant to your project, cached between sessions
- **Project Memory** — Remembers your tool choices and usage per project across sessions
- **Auto-Discovery** — Automatically detects newly installed skills, plugins, hooks, and MCP servers

## Features

| Feature | Description |
|---------|-------------|
| `/scout` | Full project scan with toolkit recommendations |
| `/scout:global` | Cross-project scan — finds tools relevant to all your projects |
| `/scout:eval` | Mid-session evaluation — compares initial advice with actual usage |
| `/scout:bootstrap` | Deep analysis for projects new to the scout methodology |
| `/scout:help` | Show the user guide |
| Action Advisor | Real-time multi-pattern suggestions with What/Why/How format |
| Online Search | Background MCP discovery from npm + Glama (7-day cache) |
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

### Global Scout (`scripts/global-scout.js`)

Aggregates tool relevance across all your projects to identify globally-useful tools:

1. Reads `~/.claude/scout-config.json` for `projectsDir`, `globalThreshold`, `minProjects`
2. Scans all subdirectories in `projectsDir` that contain a recognized project file (`package.json`, `go.mod`, `pyproject.toml`, etc.)
3. Runs the scoring algorithm for every catalog entry against every project
4. A tool becomes **globally relevant** if it scores >0 in ≥ `globalThreshold` fraction of projects (default 40%) OR in ≥ `minProjects` projects
5. Writes the global tool list to `~/.claude/scout-global-profile.json`
6. Updates `~/.claude/CLAUDE.md` with a `<!-- scout:global:start/end -->` section listing the tools
7. Adds a one-time trigger instruction to `~/.claude/CLAUDE.md` telling Claude when to invoke `/scout` for new projects

Configuration at `~/.claude/scout-config.json`:
```json
{
  "projectsDir": "~/projects",
  "globalThreshold": 0.4,
  "minProjects": 2
}
```

#### Two-layer helper model

| Layer | Where stored | When written | Contains |
|-------|-------------|--------------|----------|
| **Global** | `~/.claude/CLAUDE.md` | After `/scout:global` | Tools relevant across ≥40% of your projects |
| **Project delta** | `{project}/CLAUDE.md` | Every session start | Tools specific to this project (globals excluded) |

This means each project's CLAUDE.md stays focused on what's unique to that project — globally-useful tools like `code-reviewer` or `quality-engineer` appear only once in the global section and are filtered out of project-specific recommendations.

### Session Scout Hook (`hooks/scout-session-start.js`)

Runs at session start:
1. Checks if catalog needs rebuild (fingerprint comparison)
2. Detects project type
3. Loads existing project profile (with validation)
4. Scores and ranks tools with tier-aware algorithm
5. Filters out tools already in the global profile (writes only the delta to project CLAUDE.md)
6. Emits top 10 toolkit briefing via `additionalContext`
7. Saves project profile (full list, before delta filtering)
8. Triggers background online search if cache is stale

### Online Search (`scripts/online-search.js`)

Discovers MCP servers relevant to your project from public registries:
- **npm registry** — Searches for `mcp-server` packages with project-aware queries (language, framework, dependencies)
- **Glama MCP registry** — Fetches from `glama.ai/api/mcp/v1/servers` with local scoring
- Results are scored against your project profile and cached per project fingerprint (7-day TTL by default)
- Background fetch runs non-blocking at session start; results appear in the next session's briefing

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
npm test             # Run all tests (189 tests)
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
│   ├── health-check.js                # Installation health verification
│   ├── global-scout.js                # Cross-project tool aggregation
│   ├── online-search.js               # MCP discovery from npm + Glama
│   └── i18n.js                        # Locale strings (en, nl, de, fr, es, zh)
├── hooks/
│   ├── scout-session-start.js         # SessionStart hook (with delta filtering)
│   └── advisor-post-tool-use.js       # PostToolUse hook (multi-pattern)
├── skills/
│   ├── session-scout/
│   │   ├── SKILL.md                   # /scout skill definition
│   │   └── GUIDE.md                   # User guide
│   ├── scout:global/SKILL.md          # /scout:global command
│   ├── scout:eval/SKILL.md            # /scout:eval command
│   ├── scout:bootstrap/SKILL.md       # /scout:bootstrap command
│   └── scout:help/SKILL.md            # /scout:help command
└── tests/                             # Vitest tests (189 tests)
    ├── fixtures/                      # Mock project configs (17 project types)
    ├── project-detector.test.js
    ├── build-skill-catalog.test.js
    ├── scout-session-start.test.js
    ├── advisor-post-tool-use.test.js
    ├── manage-hooks.test.js
    ├── health-check.test.js
    ├── online-search.test.js
    └── global-scout.test.js
```

## License

MIT
