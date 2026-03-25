# Claude Scout Improvement Design

## Context

Claude Scout is an intelligent toolkit advisor for Claude Code that recommends skills, agents, hooks, and MCP servers based on project context. It consists of 4 Node.js scripts, 1 skill definition, and an install script.

### Current Issues
1. **Hook validation failure** — Missing `hookEventName` in JSON output (fixed)
2. **No `package.json`** — No dependency management, no test scripts, project undetectable by its own detector
3. **No tests** — Zero coverage on scripts that run at every session start
4. **Manual hook registration** — Install script copies files but doesn't register hooks in `settings.json`
5. **Noisy scoring** — Keyword-based tag inference produces false positives
6. **Limited project detector** — Missing Go frameworks, Angular, SvelteKit, monorepo detection
7. **Fragile eval state** — Session state stored in `/tmp/`, lost on reboot
8. **Single-pattern matching** — Action advisor returns only the highest-confidence match

## Approach

Phased improvement: each phase delivers a working, better product.

- **Phase 1 (Foundation)** — package.json, CLAUDE.md, tests, install automation
- **Phase 2 (Quality)** — Scoring improvements, better tag inference, detector expansion, error handling
- **Phase 3 (Features)** — Eval improvements, multi-pattern matching, MCP enrichment, install UX

---

## Phase 1 — Foundation

### 1.1 package.json

Add `package.json` to the project root:
- `name`: `claude-scout`
- `type`: `commonjs` (existing code uses `require`)
- `scripts.test`: `vitest run`
- `scripts.build-catalog`: `node scripts/build-skill-catalog.js`
- `scripts.detect`: `node scripts/project-detector.js`
- `devDependencies`: `vitest` only — no runtime dependencies, everything stays Node.js built-in

### 1.2 CLAUDE.md

Add project-level CLAUDE.md with:
- Project purpose and architecture overview
- File structure and responsibilities
- How to run tests
- Coding conventions (CommonJS, no external runtime deps, JSON output on stdout, errors on stderr)

### 1.3 Tests (vitest)

Four test files covering the core modules:

**`tests/project-detector.test.js`**
- Test detection for each language: JS, TS, Python, Rust, Go, Ruby, Swift, Java
- Test framework detection within each language ecosystem
- Test database, test runner, Docker, CI/CD detection
- Test edge cases: empty directory, multiple languages, missing files

**`tests/build-skill-catalog.test.js`**
- Test `inferTags()`: keyword matching, word boundaries, false positive prevention
- Test `parseFrontmatter()`: valid YAML, missing frontmatter, malformed content
- Test `summarize()`: truncation, edge cases
- Test deduplication logic
- Test index structure (byTag, byLang, byFramework, byDomain)

**`tests/scout-session-start.test.js`**
- Test `scoreSkill()`: language match, framework match, domain boost, historical usage boost, penalty for wrong language
- Test `formatBriefing()`: grouping by source, profile info display
- Test `needsRebuild()`: age check, fingerprint comparison
- Test JSON output structure includes `hookEventName`

**`tests/advisor-post-tool-use.test.js`**
- Test `analyzeAction()`: each pattern (testing, api, database, security, frontend, docker, build-error, git, data-science)
- Test debounce logic: 2-minute global, 10-minute per-pattern
- Test `formatSuggestion()`: output format
- Test JSON output structure includes `hookEventName`

### 1.4 Install Script Improvements

Enhance `install.sh`:
- **Auto-register hooks** in `~/.claude/settings.json` using `node` for JSON manipulation (not `jq` — may not be installed)
- **Idempotent**: re-running doesn't duplicate hooks; checks if already registered before adding
- **Merge strategy**: read existing settings, add SessionStart and PostToolUse hooks only if not present, write back
- **`--uninstall` flag**: remove Scout hooks from settings.json and delete copied files
- **Validation**: verify Node.js is available, verify files copied successfully

Helper script `scripts/manage-hooks.js`:
- `node scripts/manage-hooks.js install` — registers hooks in settings.json (exit 0 on success, exit 1 on error)
- `node scripts/manage-hooks.js uninstall` — removes hooks from settings.json (exit 0 on success, exit 1 on error)
- stdout: single JSON line with `{"success": true, "action": "install|uninstall", "hooks": ["SessionStart", "PostToolUse"]}`
- stderr: human-readable error messages
- Missing `settings.json`: creates minimal file with `{"hooks": {...}}` structure
- Corrupt `settings.json`: logs error to stderr, exits 1, does not overwrite
- Partial registration: checks each hook independently; adds only missing ones
- File permissions: respects user's umask (no explicit chmod)

### 1.5 Bugfix: hookEventName (completed)

All hook JSON outputs now include the required `hookEventName` field:
- `scout-session-start.js`: `hookEventName: 'SessionStart'` in all 3 output paths
- `advisor-post-tool-use.js`: `hookEventName: 'PostToolUse'` in all 4 output paths

---

## Phase 2 — Quality

### 2.1 Scoring Algorithm

Replace flat scoring with weighted categories:

```
Score = langScore + fwScore + domainScore + depScore + historyBonus - penalties

langScore:    Language match → +10 (required for skill source; universal sources exempt)
fwScore:      Framework match → +15
domainScore:  Domain relevance → +5 (only if lang/fw already matched)
depScore:     Direct dependency match → +8 (new: match package.json deps against skill keywords)
historyBonus: Historical usage → +2 per use (max +10)
penalties:    Wrong language entirely → score = 0
              Niche skill without lang match → score = 0
```

Add skill tiers:
- **Core**: language/framework-specific skills (require lang match)
- **Universal**: git, planning, refactoring agents (always eligible)
- **Niche**: scientific/domain-specific (require explicit match, high threshold)

Tier classification rules:
- **Core** (`source === 'skill'` AND `languages.length > 0`): Must match project language
- **Universal** (`source === 'agent'` OR `source === 'gsd'` OR `source === 'hook'` OR `domains` only contains universal domains like `git`, `planning`, `refactoring`, `documentation`): Always eligible for scoring
- **Niche** (`source === 'skill'` AND has scientific/specialized keywords like `genomics`, `molecular`, `quantum`, `spectral`): Require explicit language + domain match, minimum score threshold of 15

### 2.2 Tag Inference

Improvements to `inferTags()` in `build-skill-catalog.js`:

- Stricter word boundaries for short keywords (≤3 chars): require `\b` on both sides
  - Problematic keywords list: `go`, `r`, `d`, `c`, `py`, `js`, `ts` — always use regex `\b`
- Separate "strong" vs "weak" keyword matches:
  - Strong (name/invoke field): contributes full score to `langScore`/`fwScore`
  - Weak (description only): contributes 50% score — prevents irrelevant matches from verbose descriptions
- Add negative keywords: if description contains "not for X" or "alternative to X", set score penalty of -5
- Add tier classification based on presence of scientific/specialized keywords

### 2.3 Project Detector Expansion

All new detections use **best-effort regex/keyword matching**, not full parsing. This avoids adding TOML/Go parser dependencies. False negatives are accepted; false positives are prevented via strict patterns.

New detections:
- **Go frameworks**: regex-match `go.mod` for known module paths (`github.com/gin-gonic/gin`, `github.com/labstack/echo`, `github.com/gofiber/fiber`) using line-by-line `require` block scanning
- **Angular**: check for `angular.json` file OR `@angular/core` in `package.json` dependencies
- **SvelteKit**: check for `@sveltejs/kit` in `package.json` dependencies
- **Monorepo**: detect `workspaces` in `package.json`, `pnpm-workspace.yaml`, `lerna.json` — sets `result.monorepo = true` flag (used as tag, no special scoring impact)
- **Python dependency parsing**: regex-match `pyproject.toml` for dependency names in `[project.dependencies]` and `[tool.poetry.dependencies]` sections using line-by-line keyword scanning (no TOML parser)

### 2.4 Error Handling

- Wrap all `JSON.parse()` calls in try/catch with stderr logging
- Add per-file timeout in catalog builder (skip files that take >500ms to parse)
- Validate `scout-profile.json` structure before using: check for required keys (`projectType`, `recommendedTools`, `usedTools`). If corrupt or invalid: delete file, start with fresh empty profile, log warning to stderr
- Separate stdout (JSON output) from stderr (diagnostics/errors) — never log non-JSON to stdout

---

## Phase 3 — Features

### 3.1 Eval Improvement

- Move session state from `/tmp/claude-advisor-{session}.json` to `{project}/.claude/scout-session-state.json`
  - `{project}` = the `cwd` value from hook input JSON (already available in both hooks)
  - Fallback: if `.claude/` dir is not writable, fall back to `/tmp/` location
- Add skill invocation tracking: detect Skill tool use via PostToolUse `tool_name === 'Skill'` + `tool_input.skill` field
- Trend analysis in eval output: compare current session usage against historical profile
- Better eval scoring: weight "used recommended tool" higher than "edited file matching tool"

### 3.2 Multi-Pattern Matching

In `advisor-post-tool-use.js`:
- Return up to 2 matches if both have confidence ≥ 3 (currently only returns top 1; max confidence is ~5)
- Bundle related suggestions into a single `additionalContext` block
- New format for bundled suggestions: "Je bewerkt een API route met auth — overweeg: [tool1] voor [reason1] en [tool2] voor [reason2]"
- Respect debounce per individual pattern, not per bundle

### 3.3 MCP Server Enrichment

In `build-skill-catalog.js`:
- Parse `.mcp.json` files for tool descriptions and capabilities
- Add MCP tools to the index with proper tagging
- Match MCP servers against project type (e.g., database MCP for projects with PostgreSQL)
- In session start briefing, show MCP servers that are installed but could be useful

### 3.4 Installation UX

- Add `bin` field to `package.json` pointing to `install.sh` for `npx claude-scout` support
- Health check script: `node scripts/health-check.js` verifying:
  - Hooks registered in settings.json
  - Catalog index exists and is fresh
  - All required files present in `~/.claude/`
- `install.sh --check` flag for dry-run verification

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `package.json` | Project metadata, scripts, dev dependencies |
| `CLAUDE.md` | Project documentation for Claude Code |
| `tests/project-detector.test.js` | Tests for project detection |
| `tests/build-skill-catalog.test.js` | Tests for catalog builder |
| `tests/scout-session-start.test.js` | Tests for session start hook |
| `tests/advisor-post-tool-use.test.js` | Tests for action advisor hook |
| `scripts/manage-hooks.js` | Hook registration/removal in settings.json |
| `scripts/health-check.js` | Installation health verification (Phase 3) |
| `vitest.config.js` | Test configuration |
| `tests/fixtures/` | Minimal project configs for testing (package.json, go.mod, etc.) |

### Modified Files
| File | Changes |
|------|---------|
| `hooks/scout-session-start.js` | hookEventName fix (done), scoring improvements (P2) |
| `hooks/advisor-post-tool-use.js` | hookEventName fix (done), multi-pattern (P3), state location (P3) |
| `scripts/build-skill-catalog.js` | Tag inference improvements (P2), MCP enrichment (P3) |
| `scripts/project-detector.js` | New language/framework detections (P2) |
| `install.sh` | Auto hook registration, uninstall flag (P1) |

### Architecture Constraints
- **No runtime dependencies** — All scripts use only Node.js built-ins
- **CommonJS** — Existing code uses `require()`, maintain consistency
- **JSON on stdout** — Hook output is always valid JSON; diagnostics go to stderr
- **Backward compatible** — Existing `scout-profile.json` files remain valid
