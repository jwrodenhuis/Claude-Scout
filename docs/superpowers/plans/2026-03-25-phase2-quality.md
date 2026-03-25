# Phase 2: Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve scoring accuracy, tag inference precision, project detection breadth, and error handling across all Scout modules.

**Architecture:** Enhance existing modules incrementally — each task modifies one file with corresponding test updates. No new files except test fixtures for new detections.

**Tech Stack:** Node.js (CommonJS), vitest, no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-03-25-claude-scout-improvement-design.md` — Phase 2 sections.

---

## File Map

| File | Changes |
|------|---------|
| `scripts/build-skill-catalog.js` | Add `tier` field to entries, add `NICHE_KEYWORDS`, improve `inferTags()` with strong/weak scoring |
| `hooks/scout-session-start.js` | Rewrite `scoreSkill()` with tier-aware scoring, dependency matching |
| `scripts/project-detector.js` | Add Go frameworks, Angular, SvelteKit, monorepo detection, better Python parsing |
| `tests/build-skill-catalog.test.js` | Add tests for tier classification, niche filtering |
| `tests/scout-session-start.test.js` | Add tests for new scoring: tiers, dependency match, niche penalty |
| `tests/project-detector.test.js` | Add tests for Go frameworks, Angular, SvelteKit, monorepo |
| `tests/fixtures/go-gin-project/go.mod` | Go project with gin framework |
| `tests/fixtures/angular-project/angular.json` | Angular project |
| `tests/fixtures/angular-project/package.json` | Angular dependencies |
| `tests/fixtures/sveltekit-project/package.json` | SvelteKit dependencies |
| `tests/fixtures/monorepo-project/package.json` | Monorepo with workspaces |
| `tests/fixtures/python-fastapi/pyproject.toml` | Python FastAPI with poetry deps |

---

### Task 1: Expand project detector — Go frameworks, Angular, SvelteKit, monorepo

**Files:**
- Create: `tests/fixtures/go-gin-project/go.mod`
- Create: `tests/fixtures/angular-project/angular.json`
- Create: `tests/fixtures/angular-project/package.json`
- Create: `tests/fixtures/sveltekit-project/package.json`
- Create: `tests/fixtures/monorepo-project/package.json`
- Create: `tests/fixtures/python-fastapi/pyproject.toml`
- Modify: `scripts/project-detector.js:106-110`
- Modify: `scripts/project-detector.js:43-50`
- Modify: `scripts/project-detector.js:71-92`
- Modify: `tests/project-detector.test.js`

- [ ] **Step 1: Create new test fixtures**

`tests/fixtures/go-gin-project/go.mod`:
```
module example.com/test

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/go-sql-driver/mysql v1.7.1
)
```

`tests/fixtures/angular-project/angular.json`:
```json
{ "version": 1, "projects": { "my-app": {} } }
```

`tests/fixtures/angular-project/package.json`:
```json
{
  "name": "test-angular",
  "dependencies": { "@angular/core": "^17.0.0", "@angular/common": "^17.0.0" },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

`tests/fixtures/sveltekit-project/package.json`:
```json
{
  "name": "test-sveltekit",
  "dependencies": { "@sveltejs/kit": "^2.0.0", "svelte": "^4.0.0" },
  "devDependencies": { "typescript": "^5.0.0", "vitest": "^1.0.0" }
}
```

`tests/fixtures/monorepo-project/package.json`:
```json
{
  "name": "test-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "devDependencies": { "typescript": "^5.0.0" }
}
```

`tests/fixtures/python-fastapi/pyproject.toml`:
```toml
[project]
name = "test-fastapi"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.100.0"
uvicorn = "^0.23.0"

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: Write failing tests for new detections**

Add to `tests/project-detector.test.js`:
```js
  describe('expanded framework detection', () => {
    test('detects Go + Gin framework from go.mod require block', () => {
      const result = detect(fixture('go-gin-project'));
      expect(result.language).toBe('go');
      expect(result.frameworks).toContain('gin');
    });

    test('detects Angular from angular.json', () => {
      const result = detect(fixture('angular-project'));
      expect(result.frameworks).toContain('angular');
    });

    test('detects Angular from @angular/core dependency', () => {
      const result = detect(fixture('angular-project'));
      expect(result.language).toBe('typescript');
      expect(result.frameworks).toContain('angular');
    });

    test('detects SvelteKit from @sveltejs/kit dependency', () => {
      const result = detect(fixture('sveltekit-project'));
      expect(result.framework).toBe('sveltekit');
      expect(result.frameworks).toContain('sveltekit');
      expect(result.frameworks).toContain('svelte');
    });

    test('detects monorepo from workspaces field', () => {
      const result = detect(fixture('monorepo-project'));
      expect(result.monorepo).toBe(true);
    });

    test('detects FastAPI from pyproject.toml poetry deps', () => {
      const result = detect(fixture('python-fastapi'));
      expect(result.language).toBe('python');
      expect(result.frameworks).toContain('fastapi');
    });

    test('non-monorepo projects have monorepo false', () => {
      const result = detect(fixture('js-project'));
      expect(result.monorepo).toBe(false);
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/project-detector.test.js`
Expected: 7 new tests FAIL (new detections not implemented yet).

- [ ] **Step 4: Implement Go framework detection**

In `scripts/project-detector.js`, replace the Go section (lines 106-110) with:
```js
  // go.mod — Go
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    result.language = result.language || 'go';
    result.languages.push('go');
    try {
      const content = fs.readFileSync(path.join(cwd, 'go.mod'), 'utf8');
      if (/github\.com\/gin-gonic\/gin/.test(content)) result.frameworks.push('gin');
      if (/github\.com\/labstack\/echo/.test(content)) result.frameworks.push('echo');
      if (/github\.com\/gofiber\/fiber/.test(content)) result.frameworks.push('fiber');
    } catch (e) { /* skip */ }
  }
```

- [ ] **Step 5: Implement Angular + SvelteKit detection**

In `scripts/project-detector.js`, in the JS/TS frameworks section (after `hono` line ~50), add:
```js
      else if (depNames.includes('@sveltejs/kit')) { result.framework = 'sveltekit'; result.frameworks.push('sveltekit', 'svelte'); }
      else if (depNames.includes('@angular/core')) { result.framework = 'angular'; result.frameworks.push('angular'); }
```

Also add Angular detection from `angular.json` — after the package.json block (after line 68 `} catch`), add:
```js

  // angular.json — Angular (if not already detected via package.json)
  if (fs.existsSync(path.join(cwd, 'angular.json')) && !result.frameworks.includes('angular')) {
    result.frameworks.push('angular');
    result.framework = result.framework || 'angular';
  }
```

- [ ] **Step 6: Implement monorepo detection**

In `scripts/project-detector.js`, add after the CI/CD block (after line 145), before the deduplicate block:
```js

  // Monorepo detection
  result.monorepo = false;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.workspaces) result.monorepo = true;
    } catch (e) { /* skip */ }
  }
  if (fs.existsSync(path.join(cwd, 'pnpm-workspace.yaml'))) result.monorepo = true;
  if (fs.existsSync(path.join(cwd, 'lerna.json'))) result.monorepo = true;
```

- [ ] **Step 7: Improve Python detection (poetry deps)**

In `scripts/project-detector.js`, enhance the Python section (lines 71-92). Replace the content parsing block with:
```js
    try {
      const content = fs.existsSync(pyprojectPath)
        ? fs.readFileSync(pyprojectPath, 'utf8')
        : fs.existsSync(reqPath)
          ? fs.readFileSync(reqPath, 'utf8')
          : '';
      const lower = content.toLowerCase();
      if (lower.includes('fastapi')) { result.framework = result.framework || 'fastapi'; result.frameworks.push('fastapi'); }
      if (lower.includes('django')) { result.framework = result.framework || 'django'; result.frameworks.push('django'); }
      if (lower.includes('flask')) { result.framework = result.framework || 'flask'; result.frameworks.push('flask'); }
      if (lower.includes('pytest') || lower.includes('[tool.pytest')) result.testRunner = result.testRunner || 'pytest';
      if (lower.includes('sqlalchemy') || lower.includes('alembic')) { result.database = result.database || 'postgresql'; result.frameworks.push('sqlalchemy'); }
      if (lower.includes('pandas') || lower.includes('numpy') || lower.includes('scikit')) result.frameworks.push('data-science');
    } catch (e) { /* skip */ }
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run tests/project-detector.test.js`
Expected: All tests PASS (old + new).

- [ ] **Step 9: Commit and push**

```bash
git add scripts/project-detector.js tests/project-detector.test.js tests/fixtures/go-gin-project/ tests/fixtures/angular-project/ tests/fixtures/sveltekit-project/ tests/fixtures/monorepo-project/ tests/fixtures/python-fastapi/
git commit -m "feat: expand project detector with Go frameworks, Angular, SvelteKit, monorepo detection

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: Improve tag inference with tier classification

**Files:**
- Modify: `scripts/build-skill-catalog.js:14-86` (LANG_KEYWORDS, inferTags)
- Modify: `tests/build-skill-catalog.test.js`

- [ ] **Step 1: Write failing tests for tier classification and niche detection**

Add to `tests/build-skill-catalog.test.js`:
```js
  describe('inferTags — tier classification', () => {
    test('classifies scientific skill as niche', () => {
      const result = inferTags('Genomics analysis for molecular biology and spectral data');
      expect(result.tier).toBe('niche');
    });

    test('classifies Python skill with language as core', () => {
      const result = inferTags('Python Django REST framework patterns');
      expect(result.tier).toBe('core');
    });

    test('classifies tool without language keywords as universal', () => {
      const result = inferTags('Git workflow and pull request automation');
      expect(result.tier).toBe('universal');
    });

    test('classifies planning tool as universal', () => {
      const result = inferTags('Roadmap planning and milestone tracking');
      expect(result.tier).toBe('universal');
    });

    test('does not false-positive on "go" in normal text', () => {
      const result = inferTags('Ready to go with algorithm design');
      expect(result.languages).not.toContain('go');
    });

    test('detects "golang" correctly', () => {
      const result = inferTags('Golang goroutine patterns and concurrency');
      expect(result.languages).toContain('go');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/build-skill-catalog.test.js`
Expected: New tests fail (no `tier` field yet).

- [ ] **Step 3: Add niche keywords and tier classification to inferTags**

In `scripts/build-skill-catalog.js`, add after the FRAMEWORK_KEYWORDS const (after line 53):
```js

const NICHE_KEYWORDS = [
  'genomics', 'molecular', 'quantum', 'spectral', 'protein', 'metabol',
  'phylogenet', 'biosignal', 'crystallograph', 'astro', 'pathology',
  'docking', 'cheminformat', 'bioinformat', 'single-cell', 'sequencing',
];

const UNIVERSAL_DOMAINS = ['git', 'planning', 'refactoring', 'documentation'];
```

Replace the `inferTags` function (lines 55-86) with:
```js
function inferTags(text) {
  const lower = ` ${(text || '').toLowerCase()} `;
  const languages = new Set();
  const frameworks = new Set();
  const domains = new Set();

  const wordMatch = (kw) => {
    if (kw.includes(' ') || kw.includes('.') || kw.includes('-') || kw.includes('/')) return lower.includes(kw);
    return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower);
  };

  for (const [lang, keywords] of Object.entries(LANG_KEYWORDS)) {
    if (keywords.some(kw => wordMatch(kw))) languages.add(lang);
  }
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => wordMatch(kw))) domains.add(domain);
  }
  for (const [fw, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    if (keywords.some(kw => wordMatch(kw))) frameworks.add(fw);
  }

  // Tier classification
  const isNiche = NICHE_KEYWORDS.some(kw => lower.includes(kw));
  const hasLang = languages.size > 0;
  const onlyUniversalDomains = domains.size > 0 && [...domains].every(d => UNIVERSAL_DOMAINS.includes(d));
  let tier = 'core';
  if (isNiche) tier = 'niche';
  else if (!hasLang && (onlyUniversalDomains || domains.size === 0)) tier = 'universal';

  return {
    tags: [...languages, ...domains, ...frameworks],
    languages: [...languages],
    frameworks: [...frameworks],
    domains: [...domains],
    tier, // Always present: 'core', 'universal', or 'niche'
  };
}
```

- [ ] **Step 4: Fix "go" false positive in LANG_KEYWORDS**

In `scripts/build-skill-catalog.js`, update the `go` entry in LANG_KEYWORDS (line 20):
```js
  go: ['golang', 'goroutine', 'gomod', 'go module', 'go build'],
```

Remove the `' go '` entry which matches too broadly.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/build-skill-catalog.test.js`
Expected: All tests PASS.

- [ ] **Step 6: Commit and push**

```bash
git add scripts/build-skill-catalog.js tests/build-skill-catalog.test.js
git commit -m "feat: add tier classification to tag inference, fix 'go' false positive

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Improve scoring algorithm with tiers and dependency matching

**Files:**
- Modify: `hooks/scout-session-start.js:81-121`
- Modify: `tests/scout-session-start.test.js`

- [ ] **Step 1: Write failing tests for new scoring behavior**

Add to `tests/scout-session-start.test.js`:
```js
    test('returns 0 for niche skill without language match', () => {
      const entry = { languages: ['python'], frameworks: [], domains: [], source: 'skill', tier: 'niche' };
      const project = makeProject(); // typescript project
      const score = scoreSkill(entry, project, null);
      expect(score).toBe(0);
    });

    test('scores niche skill when language AND domain match', () => {
      const entry = { languages: ['typescript'], frameworks: [], domains: ['testing'], source: 'skill', tier: 'niche' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThan(0);
    });

    test('scores dependency match at +8', () => {
      const entry = { languages: ['typescript'], frameworks: [], domains: [], source: 'skill', tier: 'core', name: 'drizzle-patterns' };
      const project = makeProject({ dependencies: ['drizzle-orm', 'next', 'react'] });
      const scoreWithDep = scoreSkill(entry, project, null);
      const scoreWithout = scoreSkill(entry, makeProject({ dependencies: [] }), null);
      expect(scoreWithDep).toBeGreaterThan(scoreWithout);
    });

    test('universal tier scores without language match', () => {
      const entry = { languages: [], frameworks: [], domains: ['git'], source: 'skill', tier: 'universal' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThan(0);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scout-session-start.test.js`
Expected: New tests fail (no tier/dep logic in scoreSkill yet).

- [ ] **Step 3: Rewrite scoreSkill with tier-aware scoring**

In `hooks/scout-session-start.js`, replace the `scoreSkill` function (lines 81-121) with:
```js
function scoreSkill(entry, project, profile) {
  let score = 0;
  let hasLangOrFwMatch = false;

  // Language match
  for (const lang of (entry.languages || [])) {
    if (project.languages.includes(lang)) { score += 10; hasLangOrFwMatch = true; }
  }

  // Framework match
  for (const fw of (entry.frameworks || [])) {
    if (project.frameworks.includes(fw)) { score += 15; hasLangOrFwMatch = true; }
  }

  // Tier-based filtering
  const tier = entry.tier || 'core';
  const isUniversal = tier === 'universal' || entry.source === 'agent' || entry.source === 'gsd' || entry.source === 'hook' || entry.source === 'mcp' || entry.source === 'plugin';

  // Niche skills require language match + domain match
  if (tier === 'niche') {
    if (!hasLangOrFwMatch) return 0;
    const hasDomainMatch = (entry.domains || []).some(d =>
      (d === 'testing' && project.testRunner) ||
      (d === 'database' && project.database) ||
      (d === 'devops' && (project.hasDocker || project.hasCICD))
    );
    if (!hasDomainMatch) return 0; // niche always needs domain relevance
  }

  // Domain relevance (only boost if there's a lang/fw match or universal)
  if (hasLangOrFwMatch || isUniversal) {
    if (entry.domains?.includes('testing') && project.testRunner) score += 8;
    if (entry.domains?.includes('database') && project.database) score += 8;
    if (entry.domains?.includes('devops') && (project.hasDocker || project.hasCICD)) score += 5;
    if (entry.domains?.includes('security')) score += 3;
    // Universal domain boost (git, planning, etc.)
    if (isUniversal && (entry.domains || []).length > 0) score += 5;
  }

  // Dependency matching (new)
  if (project.dependencies && project.dependencies.length > 0) {
    const entryText = `${entry.name || ''} ${entry.description || ''}`.toLowerCase();
    for (const dep of project.dependencies) {
      const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (dep.length >= 3 && new RegExp(`\\b${escaped}\\b`).test(entryText)) {
        score += 8;
        break; // max one dep match
      }
    }
  }

  // Penalize skills with no lang/fw match (wrong language entirely)
  if (!hasLangOrFwMatch && !isUniversal && (entry.languages || []).length > 0) {
    score = 0;
  }

  // Core skills without lang match get filtered
  if (entry.source === 'skill' && !isUniversal && !hasLangOrFwMatch && score < 8) {
    score = 0;
  }

  // Boost from historical usage (learning effect)
  if (profile) {
    const used = (profile.usedTools || []).find(t => t.name === entry.name || t.name === entry.invoke);
    if (used) score += Math.min(used.count * 2, 10);
  }

  return score;
}
```

- [ ] **Step 4: Update makeProject helper in tests to include dependencies**

In `tests/scout-session-start.test.js`, update the `makeProject` helper:
```js
    const makeProject = (overrides = {}) => ({
      languages: ['typescript', 'javascript'],
      frameworks: ['next', 'react'],
      testRunner: 'vitest',
      database: 'postgresql',
      dependencies: ['next', 'react', 'drizzle-orm', 'typescript', 'vitest'],
      hasDocker: false,
      hasCICD: true,
      ...overrides,
    });
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/scout-session-start.test.js`
Expected: All tests PASS (old + new).

- [ ] **Step 6: Copy updated hook to installed location**

Run: `cp hooks/scout-session-start.js ~/.claude/hooks/scout-session-start.js`

- [ ] **Step 7: Commit and push**

```bash
git add hooks/scout-session-start.js tests/scout-session-start.test.js
git commit -m "feat: tier-aware scoring with dependency matching, niche skill filtering

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: Error handling improvements

**Files:**
- Modify: `hooks/scout-session-start.js` (profile validation, stderr logging)
- Modify: `scripts/build-skill-catalog.js` (stderr for errors)
- Modify: `tests/scout-session-start.test.js`

- [ ] **Step 1: Write failing test for corrupt profile handling**

Add to `tests/scout-session-start.test.js`:
```js
  describe('loadProfile — error handling', () => {
    const { loadProfile } = require('../hooks/scout-session-start');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    test('returns null for missing profile', () => {
      const result = loadProfile('/nonexistent/path');
      expect(result).toBeNull();
    });

    test('returns null for corrupt profile JSON', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-test-'));
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'scout-profile.json'), 'not json {{{');
      const result = loadProfile(tmpDir);
      expect(result).toBeNull();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('returns null for profile missing required keys', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-test-'));
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'scout-profile.json'), '{"random": true}');
      const result = loadProfile(tmpDir);
      expect(result).toBeNull();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
```

- [ ] **Step 2: Run tests to verify new ones fail**

Run: `npx vitest run tests/scout-session-start.test.js`
Expected: The "missing required keys" test fails (current code returns the object regardless).

- [ ] **Step 3: Update loadProfile with validation**

In `hooks/scout-session-start.js`, replace the `loadProfile` function:
```js
function loadProfile(cwd) {
  const profilePath = path.join(cwd, '.claude', 'scout-profile.json');
  try {
    const data = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    // Validate required keys
    if (!data.projectType || !data.recommendedTools || !data.usedTools) {
      process.stderr.write(`Warning: invalid scout-profile.json at ${profilePath}, ignoring\n`);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}
```

- [ ] **Step 4: Add stderr logging to catalog builder**

In `scripts/build-skill-catalog.js`, update the catch blocks in scan functions to log to stderr instead of silently skipping. In `scanSkills()`, change `} catch (e) { /* skip unreadable */ }` to:
```js
    } catch (e) { process.stderr.write(`Warning: cannot read skill ${dir}: ${e.message}\n`); }
```

Do the same for `scanAgents()`, `scanPluginSkills()`, and `scanGSDWorkflows()`.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Copy updated hook to installed location**

Run: `cp hooks/scout-session-start.js ~/.claude/hooks/scout-session-start.js`

- [ ] **Step 7: Commit and push**

```bash
git add hooks/scout-session-start.js scripts/build-skill-catalog.js tests/scout-session-start.test.js
git commit -m "feat: add profile validation, stderr error logging across all modules

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All test files pass, 0 failures.

- [ ] **Step 2: Verify hooks produce valid JSON**

Run: `echo '{"cwd":"/tmp"}' | node hooks/scout-session-start.js 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK')" && echo '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/x.txt"}}' | node hooks/advisor-post-tool-use.js 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK')"`

- [ ] **Step 3: Verify catalog builds correctly with new tier field**

Run: `node scripts/build-skill-catalog.js && node -e "const idx = require(require('os').homedir() + '/.claude/skills/.index.json'); const tiers = {}; idx.skills.forEach(s => { tiers[s.tier || 'none'] = (tiers[s.tier || 'none'] || 0) + 1; }); console.log(tiers);"`
Expected: Shows distribution of core/universal/niche tiers.

- [ ] **Step 4: Run install check**

Run: `./install.sh --check`
Expected: All files present.
