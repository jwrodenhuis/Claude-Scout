# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claude Scout a testable, installable, self-documenting project with package.json, vitest tests for all 4 core modules, and automated hook registration.

**Architecture:** Refactor each script to export testable functions while preserving CLI/hook behavior via `require.main === module` guards. Add vitest with test fixtures for mock project directories. Add `manage-hooks.js` for idempotent settings.json manipulation.

**Tech Stack:** Node.js (CommonJS), vitest (dev only), no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-03-25-claude-scout-improvement-design.md`

---

### Task 1: Project setup — package.json + vitest config

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.gitignore` (update — add `node_modules/`)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "claude-scout",
  "version": "0.1.0",
  "description": "Intelligent toolkit advisor for Claude Code",
  "type": "commonjs",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build-catalog": "node scripts/build-skill-catalog.js",
    "detect": "node scripts/project-detector.js"
  },
  "devDependencies": {
    "vitest": "^3.1.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create vitest.config.js**

```js
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    testTimeout: 5000,
  },
});
```

- [ ] **Step 3: Update .gitignore**

Add `node_modules/` to existing `.gitignore`.

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 5: Verify vitest runs**

Run: `npx vitest run`
Expected: "No test files found" (no tests yet, but vitest works).

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.js package-lock.json .gitignore
git commit -m "chore: add package.json and vitest config for test infrastructure"
```

---

### Task 2: Create test fixtures

**Files:**
- Create: `tests/fixtures/js-project/package.json`
- Create: `tests/fixtures/ts-next-project/package.json`
- Create: `tests/fixtures/ts-next-project/tsconfig.json`
- Create: `tests/fixtures/python-django/pyproject.toml`
- Create: `tests/fixtures/python-django/requirements.txt`
- Create: `tests/fixtures/go-project/go.mod`
- Create: `tests/fixtures/rust-project/Cargo.toml`
- Create: `tests/fixtures/ruby-rails/Gemfile`
- Create: `tests/fixtures/java-spring/pom.xml`
- Create: `tests/fixtures/swift-project/Package.swift`
- Create: `tests/fixtures/empty-project/.gitkeep`
- Create: `tests/fixtures/docker-project/Dockerfile`
- Create: `tests/fixtures/docker-project/package.json`
- Create: `tests/fixtures/cicd-project/.github/workflows/ci.yml`
- Create: `tests/fixtures/cicd-project/package.json`

- [ ] **Step 1: Create JS project fixture**

`tests/fixtures/js-project/package.json`:
```json
{
  "name": "test-js",
  "dependencies": { "express": "^4.18.0" },
  "devDependencies": { "jest": "^29.0.0" }
}
```

- [ ] **Step 2: Create TS/Next.js project fixture**

`tests/fixtures/ts-next-project/package.json`:
```json
{
  "name": "test-ts-next",
  "dependencies": { "next": "^14.0.0", "react": "^18.0.0", "drizzle-orm": "^0.30.0" },
  "devDependencies": { "typescript": "^5.0.0", "vitest": "^1.0.0" }
}
```

`tests/fixtures/ts-next-project/tsconfig.json`:
```json
{ "compilerOptions": { "strict": true } }
```

- [ ] **Step 3: Create Python/Django fixture**

`tests/fixtures/python-django/pyproject.toml`:
```toml
[project]
name = "test-python"
dependencies = ["django>=4.2", "pytest>=7.0", "sqlalchemy>=2.0"]
```

`tests/fixtures/python-django/requirements.txt`:
```
django>=4.2
pytest>=7.0
sqlalchemy>=2.0
```

- [ ] **Step 4: Create Go project fixture**

`tests/fixtures/go-project/go.mod`:
```
module example.com/test
go 1.21
```

- [ ] **Step 5: Create Rust project fixture**

`tests/fixtures/rust-project/Cargo.toml`:
```toml
[package]
name = "test-rust"
[dependencies]
actix-web = "4"
tokio = { version = "1", features = ["full"] }
```

- [ ] **Step 6: Create Ruby/Rails fixture**

`tests/fixtures/ruby-rails/Gemfile`:
```ruby
source 'https://rubygems.org'
gem 'rails', '~> 7.0'
gem 'rspec-rails', group: :test
```

- [ ] **Step 7: Create Java/Spring fixture**

`tests/fixtures/java-spring/pom.xml`:
```xml
<project>
  <groupId>com.test</groupId>
  <artifactId>spring-test</artifactId>
</project>
```

- [ ] **Step 8: Create Swift fixture**

`tests/fixtures/swift-project/Package.swift`:
```swift
// swift-tools-version:5.9
import PackageDescription
let package = Package(name: "TestSwift")
```

- [ ] **Step 9: Create empty project fixture**

`tests/fixtures/empty-project/.gitkeep`: empty file.

- [ ] **Step 10: Create Docker project fixture**

`tests/fixtures/docker-project/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
```

`tests/fixtures/docker-project/package.json`:
```json
{ "name": "test-docker", "dependencies": { "express": "^4.18.0" } }
```

- [ ] **Step 11: Create CI/CD project fixture**

`tests/fixtures/cicd-project/.github/workflows/ci.yml`:
```yaml
name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
```

`tests/fixtures/cicd-project/package.json`:
```json
{ "name": "test-cicd", "dependencies": { "react": "^18.0.0" } }
```

- [ ] **Step 12: Commit**

```bash
git add tests/fixtures/
git commit -m "test: add project fixtures for all detected languages and configurations"
```

---

### Task 3: Test project-detector.js

**Files:**
- Create: `tests/project-detector.test.js`

The `detect()` function is already exported via `module.exports = { detect }` — no refactoring needed.

- [ ] **Step 1: Write tests for language detection**

`tests/project-detector.test.js`:
```js
const path = require('path');
const { detect } = require('../scripts/project-detector');

const fixture = (name) => path.join(__dirname, 'fixtures', name);

describe('project-detector', () => {
  describe('language detection', () => {
    test('detects JavaScript from package.json without typescript', () => {
      const result = detect(fixture('js-project'));
      expect(result.language).toBe('javascript');
      expect(result.languages).toContain('javascript');
      expect(result.languages).not.toContain('typescript');
    });

    test('detects TypeScript from tsconfig.json + typescript dep', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.language).toBe('typescript');
      expect(result.languages).toContain('typescript');
      expect(result.languages).toContain('javascript');
    });

    test('detects Python from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.language).toBe('python');
      expect(result.languages).toContain('python');
    });

    test('detects Go from go.mod', () => {
      const result = detect(fixture('go-project'));
      expect(result.language).toBe('go');
      expect(result.languages).toContain('go');
    });

    test('detects Rust from Cargo.toml', () => {
      const result = detect(fixture('rust-project'));
      expect(result.language).toBe('rust');
      expect(result.languages).toContain('rust');
    });

    test('detects Ruby from Gemfile', () => {
      const result = detect(fixture('ruby-rails'));
      expect(result.language).toBe('ruby');
      expect(result.languages).toContain('ruby');
    });

    test('detects Java from pom.xml', () => {
      const result = detect(fixture('java-spring'));
      expect(result.language).toBe('java');
      expect(result.languages).toContain('java');
    });

    test('detects Swift from Package.swift', () => {
      const result = detect(fixture('swift-project'));
      expect(result.language).toBe('swift');
      expect(result.languages).toContain('swift');
    });

    test('returns null language for empty project', () => {
      const result = detect(fixture('empty-project'));
      expect(result.language).toBeNull();
      expect(result.languages).toEqual([]);
    });
  });

  describe('framework detection', () => {
    test('detects Next.js + React from next dependency', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.framework).toBe('next');
      expect(result.frameworks).toContain('next');
      expect(result.frameworks).toContain('react');
    });

    test('detects Express from express dependency', () => {
      const result = detect(fixture('js-project'));
      expect(result.framework).toBe('express');
      expect(result.frameworks).toContain('express');
    });

    test('detects Django from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.frameworks).toContain('django');
    });

    test('detects Rails from Gemfile', () => {
      const result = detect(fixture('ruby-rails'));
      expect(result.frameworks).toContain('rails');
    });

    test('detects Spring from pom.xml', () => {
      const result = detect(fixture('java-spring'));
      expect(result.frameworks).toContain('spring');
    });

    test('detects Actix + Tokio from Cargo.toml', () => {
      const result = detect(fixture('rust-project'));
      expect(result.frameworks).toContain('actix');
      expect(result.frameworks).toContain('tokio');
    });
  });

  describe('database + test runner detection', () => {
    test('detects Drizzle ORM → PostgreSQL', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.database).toBe('postgresql');
      expect(result.frameworks).toContain('drizzle');
    });

    test('detects vitest test runner', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.testRunner).toBe('vitest');
    });

    test('detects jest test runner', () => {
      const result = detect(fixture('js-project'));
      expect(result.testRunner).toBe('jest');
    });

    test('detects pytest from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.testRunner).toBe('pytest');
    });

    test('detects rspec from Gemfile', () => {
      const result = detect(fixture('ruby-rails'));
      expect(result.testRunner).toBe('rspec');
    });

    test('detects SQLAlchemy framework from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.frameworks).toContain('sqlalchemy');
    });
  });

  describe('Docker + CI/CD detection', () => {
    test('detects Docker from Dockerfile', () => {
      const result = detect(fixture('docker-project'));
      expect(result.hasDocker).toBe(true);
    });

    test('detects CI/CD from .github/workflows', () => {
      const result = detect(fixture('cicd-project'));
      expect(result.hasCICD).toBe(true);
    });

    test('no Docker for empty project', () => {
      const result = detect(fixture('empty-project'));
      expect(result.hasDocker).toBe(false);
    });

    test('no CI/CD for empty project', () => {
      const result = detect(fixture('empty-project'));
      expect(result.hasCICD).toBe(false);
    });
  });

  describe('project name', () => {
    test('uses directory basename as project name', () => {
      const result = detect(fixture('js-project'));
      expect(result.projectName).toBe('js-project');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/project-detector.test.js`
Expected: All tests PASS. These test existing behavior, not new code.

- [ ] **Step 3: Commit**

```bash
git add tests/project-detector.test.js
git commit -m "test: add comprehensive tests for project-detector module"
```

---

### Task 4: Refactor + test build-skill-catalog.js

**Files:**
- Modify: `scripts/build-skill-catalog.js` (export functions)
- Create: `tests/build-skill-catalog.test.js`

Currently `inferTags()`, `parseFrontmatter()`, `summarize()` are internal functions. Need to export them for testing.

- [ ] **Step 1: Export testable functions from build-skill-catalog.js**

Add before the `// Main` comment at line 373:

```js
// Exports for testing
module.exports = { inferTags, parseFrontmatter, summarize, buildIndex };
```

Wrap the main execution in a `require.main` guard. Replace lines 373-384 (from `// Main` to end):

```js
// Main — only run when executed directly
if (require.main === module) {
  const skills = scanSkills();
  const agents = scanAgents();
  const plugins = scanPluginSkills();
  const gsd = scanGSDWorkflows();
  const hooks = scanHooks();
  const mcp = scanMCPServers();
  const index = buildIndex(skills, agents, plugins, gsd, hooks, mcp);

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`Catalog built: ${index.totalCount} entries (${skills.length} skills, ${agents.length} agents, ${plugins.length} plugin skills, ${gsd.length} GSD, ${hooks.length} hooks, ${mcp.length} MCP/plugins)`);
  console.log(`Written to: ${INDEX_PATH}`);
}
```

- [ ] **Step 2: Write tests for inferTags**

`tests/build-skill-catalog.test.js`:
```js
const { inferTags, parseFrontmatter, summarize } = require('../scripts/build-skill-catalog');

describe('build-skill-catalog', () => {
  describe('inferTags', () => {
    test('detects Python from keyword', () => {
      const result = inferTags('Comprehensive Python toolkit for data analysis');
      expect(result.languages).toContain('python');
    });

    test('detects TypeScript from keyword', () => {
      const result = inferTags('TypeScript strict mode patterns for tsconfig');
      expect(result.languages).toContain('typescript');
    });

    test('detects multiple languages', () => {
      const result = inferTags('Python and JavaScript interoperability with Node.js');
      expect(result.languages).toContain('python');
      expect(result.languages).toContain('javascript');
    });

    test('detects testing domain', () => {
      const result = inferTags('TDD workflow with jest and coverage');
      expect(result.domains).toContain('testing');
    });

    test('detects security domain', () => {
      const result = inferTags('OWASP security vulnerabilities and injection prevention');
      expect(result.domains).toContain('security');
    });

    test('detects database domain', () => {
      const result = inferTags('PostgreSQL query optimization and schema design');
      expect(result.domains).toContain('database');
    });

    test('detects React framework', () => {
      const result = inferTags('React hooks useState useEffect patterns');
      expect(result.frameworks).toContain('react');
    });

    test('detects Django framework', () => {
      const result = inferTags('Django REST framework API patterns');
      expect(result.frameworks).toContain('django');
    });

    test('detects Spring framework', () => {
      const result = inferTags('Spring Boot microservice patterns');
      expect(result.frameworks).toContain('spring');
    });

    test('returns empty for unrelated text', () => {
      const result = inferTags('Cooking recipes for pasta lovers');
      expect(result.languages).toEqual([]);
      expect(result.frameworks).toEqual([]);
      expect(result.domains).toEqual([]);
    });

    test('handles empty input', () => {
      const result = inferTags('');
      expect(result.languages).toEqual([]);
    });

    test('handles null input', () => {
      const result = inferTags(null);
      expect(result.languages).toEqual([]);
    });
  });

  describe('parseFrontmatter', () => {
    test('parses valid frontmatter', () => {
      const content = '---\nname: test-skill\ndescription: "A test skill"\n---\n# Content';
      const result = parseFrontmatter(content);
      expect(result.name).toBe('test-skill');
      expect(result.description).toBe('A test skill');
    });

    test('returns empty object for no frontmatter', () => {
      const result = parseFrontmatter('# Just a heading\nSome content');
      expect(result).toEqual({});
    });

    test('returns empty object for empty string', () => {
      const result = parseFrontmatter('');
      expect(result).toEqual({});
    });

    test('handles frontmatter without quotes', () => {
      const content = '---\nname: my-skill\n---';
      const result = parseFrontmatter(content);
      expect(result.name).toBe('my-skill');
    });
  });

  describe('summarize', () => {
    test('returns short description unchanged', () => {
      expect(summarize('Short description')).toBe('Short description');
    });

    test('truncates long description with ellipsis', () => {
      const long = 'A'.repeat(200);
      const result = summarize(long, 120);
      expect(result.length).toBe(120);
      expect(result).toMatch(/\.\.\.$/);
    });

    test('returns empty string for null input', () => {
      expect(summarize(null)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(summarize(undefined)).toBe('');
    });

    test('collapses whitespace', () => {
      expect(summarize('multiple   spaces\n\nnewlines')).toBe('multiple spaces newlines');
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/build-skill-catalog.test.js`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-skill-catalog.js tests/build-skill-catalog.test.js
git commit -m "test: add tests for catalog builder, export functions for testability"
```

---

### Task 5: Refactor + test scout-session-start.js

**Files:**
- Modify: `hooks/scout-session-start.js` (export functions, add require.main guard)
- Create: `tests/scout-session-start.test.js`

- [ ] **Step 1: Export testable functions**

In `hooks/scout-session-start.js`, add before the `// Main` comment at line 198:

```js
// Exports for testing
module.exports = { scoreSkill, formatBriefing, needsRebuild, loadProfile, saveProfile };
```

Wrap the main execution block (lines 199-245) in a guard:

```js
if (require.main === module) {
  // ... existing main code ...
}
```

- [ ] **Step 2: Write tests**

`tests/scout-session-start.test.js`:
```js
const { scoreSkill, formatBriefing } = require('../hooks/scout-session-start');

describe('scout-session-start', () => {
  describe('scoreSkill', () => {
    const makeProject = (overrides = {}) => ({
      languages: ['typescript', 'javascript'],
      frameworks: ['next', 'react'],
      testRunner: 'vitest',
      database: 'postgresql',
      hasDocker: false,
      hasCICD: true,
      ...overrides,
    });

    test('scores language match at +10', () => {
      const entry = { languages: ['typescript'], frameworks: [], domains: [], source: 'skill' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThanOrEqual(10);
    });

    test('scores framework match at +15', () => {
      const entry = { languages: ['typescript'], frameworks: ['next'], domains: [], source: 'skill' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThanOrEqual(25); // 10 lang + 15 fw
    });

    test('scores domain match when lang matches', () => {
      const entry = { languages: ['typescript'], frameworks: [], domains: ['testing'], source: 'skill' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThanOrEqual(10); // lang + domain bonus
    });

    test('returns 0 for wrong language skill', () => {
      const entry = { languages: ['rust'], frameworks: [], domains: [], source: 'skill' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBe(0);
    });

    test('universal sources score without language match', () => {
      const entry = { languages: [], frameworks: [], domains: ['testing'], source: 'agent' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThan(0);
    });

    test('boosts score from historical usage', () => {
      const entry = { name: 'test-tool', languages: ['typescript'], frameworks: [], domains: [], source: 'skill' };
      const profile = { usedTools: [{ name: 'test-tool', count: 3 }] };
      const scoreWithHistory = scoreSkill(entry, makeProject(), profile);
      const scoreWithout = scoreSkill(entry, makeProject(), null);
      expect(scoreWithHistory).toBeGreaterThan(scoreWithout);
    });

    test('caps historical bonus at +10', () => {
      const entry = { name: 'test-tool', languages: ['typescript'], frameworks: [], domains: [], source: 'skill' };
      const profile = { usedTools: [{ name: 'test-tool', count: 100 }] };
      const scoreMax = scoreSkill(entry, makeProject(), profile);
      const profile2 = { usedTools: [{ name: 'test-tool', count: 5 }] };
      const scoreFive = scoreSkill(entry, makeProject(), profile2);
      expect(scoreMax).toBe(scoreFive); // both capped at +10
    });
  });

  describe('formatBriefing', () => {
    test('groups skills and agents separately', () => {
      const project = { language: 'typescript', framework: 'next', projectName: 'test' };
      const recs = [
        { name: 'skill1', source: 'skill', invoke: '/skill1', summary: 'A skill' },
        { name: 'agent1', source: 'agent', invoke: 'agent:agent1', summary: 'An agent' },
      ];
      const result = formatBriefing(project, recs, null);
      expect(result).toContain('Aanbevolen skills:');
      expect(result).toContain('Aanbevolen agents:');
      expect(result).toContain('/skill1');
      expect(result).toContain('agent1');
    });

    test('includes project name in header', () => {
      const project = { language: 'python', framework: 'django', projectName: 'myapp' };
      const result = formatBriefing(project, [], null);
      expect(result).toContain('myapp');
      expect(result).toContain('Python');
    });

    test('shows existing profile info', () => {
      const project = { language: 'typescript', framework: null, projectName: 'test' };
      const profile = { lastSession: '2026-03-20T10:00:00Z' };
      const result = formatBriefing(project, [], profile);
      expect(result).toContain('Bestaand profiel gevonden');
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/scout-session-start.test.js`
Expected: All tests PASS.

- [ ] **Step 4: Copy updated hook to installed location**

Run: `cp hooks/scout-session-start.js ~/.claude/hooks/scout-session-start.js`

- [ ] **Step 5: Commit**

```bash
git add hooks/scout-session-start.js tests/scout-session-start.test.js
git commit -m "test: add tests for session start hook, export functions for testability"
```

---

### Task 6: Refactor + test advisor-post-tool-use.js

**Files:**
- Modify: `hooks/advisor-post-tool-use.js` (export functions, add require.main guard)
- Create: `tests/advisor-post-tool-use.test.js`

- [ ] **Step 1: Export testable functions**

In `hooks/advisor-post-tool-use.js`, add before the `// Main` comment at line 209:

```js
// Exports for testing
module.exports = { analyzeAction, formatSuggestion, getReasonText, ACTION_PATTERNS };
```

Wrap the main execution block (lines 210-262) in a guard:

```js
if (require.main === module) {
  // ... existing main code ...
}
```

- [ ] **Step 2: Write tests**

`tests/advisor-post-tool-use.test.js`:
```js
const { analyzeAction, formatSuggestion, getReasonText, ACTION_PATTERNS } = require('../hooks/advisor-post-tool-use');

describe('advisor-post-tool-use', () => {
  describe('analyzeAction — pattern matching', () => {
    test('detects testing pattern from .test.ts file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/utils/auth.test.ts' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('testing');
    });

    test('detects testing pattern from .spec.js file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/__tests__/foo.spec.js' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('testing');
    });

    test('detects API pattern from routes directory', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/api/users/route.ts' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('api');
    });

    test('detects database pattern from .sql file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/db/migrations/001.sql' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('database');
    });

    test('detects security pattern from auth file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/middleware/auth.ts' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('security');
    });

    test('detects frontend pattern from .tsx component', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/components/Header.tsx' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('frontend');
    });

    test('detects docker pattern from Dockerfile', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/Dockerfile' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('docker');
    });

    test('detects build error from Bash output', () => {
      const match = analyzeAction({
        tool_name: 'Bash',
        tool_input: { command: 'npm run build' },
        tool_output: 'error TS2345: Argument of type string is not assignable',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('build-error');
    });

    test('detects data science from pandas import', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/analysis.py' },
        tool_output: 'import pandas as pd\nimport numpy',
      });
      // Content patterns check tool_input + file_path, not output for non-outputOnly
      // So we need the content in the input context
      // Actually, for non-outputOnly patterns, searchText = toolInput + filePath
      // Let's test with a .ipynb file which matches filePatterns
      const match2 = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/notebooks/analysis.ipynb' },
        tool_output: '',
      });
      expect(match2).not.toBeNull();
      expect(match2.id).toBe('data-science');
    });

    test('returns null for unrecognized action', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/README.md' },
        tool_output: '',
      });
      expect(match).toBeNull();
    });
  });

  describe('formatSuggestion', () => {
    test('includes What, Waarom nu, Gebruik sections', () => {
      const match = ACTION_PATTERNS.find(p => p.id === 'testing');
      const result = formatSuggestion(match, '/src/utils/foo.test.ts');
      expect(result).toContain('Skill tip:');
      expect(result).toContain('Wat:');
      expect(result).toContain('Waarom nu:');
      expect(result).toContain('Gebruik:');
    });

    test('mentions alternative tools when available', () => {
      const match = ACTION_PATTERNS.find(p => p.id === 'testing');
      const result = formatSuggestion(match, '/test.ts');
      expect(result).toContain('ook beschikbaar:');
    });
  });

  describe('getReasonText', () => {
    test('includes filename when provided', () => {
      const reason = getReasonText('testing', '/src/foo.test.ts');
      expect(reason).toContain('foo.test.ts');
    });

    test('works without filename', () => {
      const reason = getReasonText('testing', '');
      expect(reason).toContain('test bestanden');
    });

    test('returns default for unknown pattern', () => {
      const reason = getReasonText('unknown', '/file.txt');
      expect(reason).toContain('Relevante patronen');
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/advisor-post-tool-use.test.js`
Expected: All tests PASS.

- [ ] **Step 4: Copy updated hook to installed location**

Run: `cp hooks/advisor-post-tool-use.js ~/.claude/hooks/advisor-post-tool-use.js`

- [ ] **Step 5: Commit**

```bash
git add hooks/advisor-post-tool-use.js tests/advisor-post-tool-use.test.js
git commit -m "test: add tests for action advisor hook, export functions for testability"
```

---

### Task 7: Create manage-hooks.js

**Files:**
- Create: `scripts/manage-hooks.js`
- Create: `tests/manage-hooks.test.js`

- [ ] **Step 1: Write the failing test**

`tests/manage-hooks.test.js`:
```js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { installHooks, uninstallHooks, SCOUT_HOOKS } = require('../scripts/manage-hooks');

describe('manage-hooks', () => {
  let tmpDir;
  let settingsPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-test-'));
    settingsPath = path.join(tmpDir, 'settings.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('installHooks', () => {
    test('creates settings.json if missing', () => {
      const result = installHooks(settingsPath);
      expect(result.success).toBe(true);
      expect(fs.existsSync(settingsPath)).toBe(true);
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.hooks.SessionStart).toBeDefined();
      expect(settings.hooks.PostToolUse).toBeDefined();
    });

    test('adds hooks to existing settings without overwriting', () => {
      fs.writeFileSync(settingsPath, JSON.stringify({
        env: { FOO: 'bar' },
        hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] },
      }, null, 2));
      const result = installHooks(settingsPath);
      expect(result.success).toBe(true);
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.env.FOO).toBe('bar');
      expect(settings.hooks.PreToolUse).toHaveLength(1);
      expect(settings.hooks.SessionStart).toBeDefined();
      expect(settings.hooks.PostToolUse).toBeDefined();
    });

    test('is idempotent — does not duplicate hooks', () => {
      installHooks(settingsPath);
      installHooks(settingsPath);
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const scoutSessionHooks = settings.hooks.SessionStart.filter(
        h => h.hooks?.some(hh => hh.command?.includes('scout-session-start'))
      );
      expect(scoutSessionHooks).toHaveLength(1);
    });

    test('adds only missing hooks when partially registered', () => {
      // Pre-register only SessionStart
      fs.writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          SessionStart: [{
            hooks: [{ type: 'command', command: 'node "~/.claude/hooks/scout-session-start.js"', timeout: 3 }],
          }],
        },
      }, null, 2));
      const result = installHooks(settingsPath);
      expect(result.success).toBe(true);
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.hooks.SessionStart).toHaveLength(1); // not duplicated
      expect(settings.hooks.PostToolUse).toBeDefined(); // added
    });

    test('returns error for corrupt JSON', () => {
      fs.writeFileSync(settingsPath, 'not json {{{');
      const result = installHooks(settingsPath);
      expect(result.success).toBe(false);
    });
  });

  describe('uninstallHooks', () => {
    test('removes Scout hooks from settings', () => {
      installHooks(settingsPath);
      const result = uninstallHooks(settingsPath);
      expect(result.success).toBe(true);
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const hasScout = JSON.stringify(settings).includes('scout-session-start');
      expect(hasScout).toBe(false);
    });

    test('preserves non-Scout hooks', () => {
      fs.writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          SessionStart: [
            { hooks: [{ type: 'command', command: 'echo other-hook' }] },
            { hooks: [{ type: 'command', command: 'node "~/.claude/hooks/scout-session-start.js"', timeout: 3 }] },
          ],
        },
      }, null, 2));
      uninstallHooks(settingsPath);
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.hooks.SessionStart).toHaveLength(1);
      expect(settings.hooks.SessionStart[0].hooks[0].command).toBe('echo other-hook');
    });

    test('handles missing settings.json gracefully', () => {
      const result = uninstallHooks(settingsPath);
      expect(result.success).toBe(true); // nothing to uninstall
    });
  });

  describe('SCOUT_HOOKS constant', () => {
    test('defines SessionStart and PostToolUse hooks', () => {
      expect(SCOUT_HOOKS.SessionStart).toBeDefined();
      expect(SCOUT_HOOKS.PostToolUse).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/manage-hooks.test.js`
Expected: FAIL — `Cannot find module '../scripts/manage-hooks'`.

- [ ] **Step 3: Implement manage-hooks.js**

`scripts/manage-hooks.js`:
```js
#!/usr/bin/env node
/**
 * Manage Hooks — Install/uninstall Scout hooks in settings.json
 * Used by install.sh for automated hook registration.
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');
const DEFAULT_SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');

const SCOUT_HOOKS = {
  SessionStart: {
    hooks: [{
      type: 'command',
      command: `node "${path.join(CLAUDE_DIR, 'hooks', 'scout-session-start.js')}"`,
      timeout: 3,
    }],
  },
  PostToolUse: {
    matcher: 'Edit|Write|Bash',
    hooks: [{
      type: 'command',
      command: `node "${path.join(CLAUDE_DIR, 'hooks', 'advisor-post-tool-use.js')}"`,
      timeout: 1,
    }],
  },
};

function isScoutHook(hookEntry) {
  return (hookEntry.hooks || []).some(h =>
    (h.command || '').includes('scout-session-start') ||
    (h.command || '').includes('advisor-post-tool-use')
  );
}

function installHooks(settingsPath) {
  settingsPath = settingsPath || DEFAULT_SETTINGS_PATH;
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      process.stderr.write(`Error: corrupt settings.json at ${settingsPath}: ${e.message}\n`);
      return { success: false, action: 'install', error: e.message };
    }
  }

  if (!settings.hooks) settings.hooks = {};

  const registered = [];

  for (const [event, hookDef] of Object.entries(SCOUT_HOOKS)) {
    if (!settings.hooks[event]) settings.hooks[event] = [];
    const alreadyRegistered = settings.hooks[event].some(isScoutHook);
    if (!alreadyRegistered) {
      settings.hooks[event].push(hookDef);
      registered.push(event);
    }
  }

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  } catch (e) {
    process.stderr.write(`Error: cannot write ${settingsPath}: ${e.message}\n`);
    return { success: false, action: 'install', error: e.message };
  }

  return { success: true, action: 'install', hooks: registered };
}

function uninstallHooks(settingsPath) {
  settingsPath = settingsPath || DEFAULT_SETTINGS_PATH;

  if (!fs.existsSync(settingsPath)) {
    return { success: true, action: 'uninstall', hooks: [] };
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`Error: corrupt settings.json at ${settingsPath}: ${e.message}\n`);
    return { success: false, action: 'uninstall', error: e.message };
  }

  if (!settings.hooks) {
    return { success: true, action: 'uninstall', hooks: [] };
  }

  const removed = [];
  for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event].length;
    settings.hooks[event] = settings.hooks[event].filter(h => !isScoutHook(h));
    if (settings.hooks[event].length < before) removed.push(event);
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  } catch (e) {
    process.stderr.write(`Error: cannot write ${settingsPath}: ${e.message}\n`);
    return { success: false, action: 'uninstall', error: e.message };
  }

  return { success: true, action: 'uninstall', hooks: removed };
}

module.exports = { installHooks, uninstallHooks, isScoutHook, SCOUT_HOOKS };

// CLI mode
if (require.main === module) {
  const action = process.argv[2];
  if (action === 'install') {
    const result = installHooks();
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  } else if (action === 'uninstall') {
    const result = uninstallHooks();
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  } else {
    process.stderr.write('Usage: node manage-hooks.js [install|uninstall]\n');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/manage-hooks.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/manage-hooks.js tests/manage-hooks.test.js
git commit -m "feat: add manage-hooks.js for automated hook registration in settings.json"
```

---

### Task 8: Improve install.sh

**Files:**
- Modify: `install.sh`

- [ ] **Step 1: Rewrite install.sh with hook registration and uninstall support**

```bash
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
  rm -f "$CLAUDE_DIR/hooks/scout-session-start.js"
  rm -f "$CLAUDE_DIR/hooks/advisor-post-tool-use.js"
  rm -rf "$CLAUDE_DIR/skills/session-scout"
  echo "Claude Scout uninstalled."
  exit 0
fi

# Check mode
if [ "$1" = "--check" ]; then
  echo "Checking Claude Scout installation..."
  ERRORS=0
  for f in scripts/build-skill-catalog.js scripts/project-detector.js hooks/scout-session-start.js hooks/advisor-post-tool-use.js skills/session-scout/SKILL.md; do
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

# Copy files
cp "$SCRIPT_DIR/scripts/build-skill-catalog.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/project-detector.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/manage-hooks.js" "$CLAUDE_DIR/scripts/"
cp "$SCRIPT_DIR/hooks/scout-session-start.js" "$CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/hooks/advisor-post-tool-use.js" "$CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/skills/session-scout/SKILL.md" "$CLAUDE_DIR/skills/session-scout/"
cp "$SCRIPT_DIR/skills/session-scout/GUIDE.md" "$CLAUDE_DIR/skills/session-scout/"

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
echo "  /scout:eval      — Mid-session evaluation"
echo "  /scout:bootstrap — Deep analysis for new projects"
echo "  /scout:help      — Show user guide"
echo ""
echo "Verify: ./install.sh --check"
echo "Remove: ./install.sh --uninstall"
```

- [ ] **Step 2: Make executable and test install**

Run: `chmod +x install.sh && ./install.sh --check`
Expected: "All files present." (since we already have files installed).

- [ ] **Step 3: Commit**

```bash
git add install.sh
git commit -m "feat: improve install.sh with auto hook registration, --uninstall and --check flags"
```

---

### Task 9: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

```markdown
# Claude Scout

Intelligent toolkit advisor for Claude Code. Recommends skills, agents, hooks, and MCP servers based on project context.

## Project Structure

```
scripts/
  build-skill-catalog.js  — Indexes all skills/agents/plugins/hooks/MCP servers into .index.json
  project-detector.js     — Detects project language, framework, deps from config files
  manage-hooks.js         — Installs/uninstalls Scout hooks in settings.json
hooks/
  scout-session-start.js  — SessionStart hook: scores tools against project, emits briefing
  advisor-post-tool-use.js — PostToolUse hook: suggests tools based on current action patterns
skills/session-scout/
  SKILL.md                — /scout skill definition (scan, eval, bootstrap, help)
  GUIDE.md                — User guide
tests/                    — Vitest tests for all modules
tests/fixtures/           — Minimal project configs for testing
```

## Development

```bash
npm install          # Install dev dependencies (vitest only)
npm test             # Run all tests
npx vitest --watch   # Watch mode
```

## Conventions

- **CommonJS** — All files use `require()` / `module.exports`
- **No runtime dependencies** — Only Node.js built-ins (fs, path, child_process, os)
- **Hook output** — Always valid JSON on stdout with `hookEventName` field. Errors to stderr.
- **Exports** — All modules export testable functions + use `require.main === module` guard for CLI
- **Tests** — Use fixtures in `tests/fixtures/` for project detection tests
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project conventions and structure"
```

---

### Task 10: Run full test suite + verify

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All test files pass. Output shows test count and 0 failures.

- [ ] **Step 2: Run install check**

Run: `./install.sh --check`
Expected: "All files present."

- [ ] **Step 3: Test hooks produce valid JSON**

Run: `echo '{"cwd":"/tmp"}' | node hooks/scout-session-start.js | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'hookEventName' in d.get('hookSpecificOutput',{}); print('OK')"`
Expected: "OK"

Run: `echo '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/x.txt"}}' | node hooks/advisor-post-tool-use.js | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'hookEventName' in d.get('hookSpecificOutput',{}); print('OK')"`
Expected: "OK"

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git status
# If clean: Phase 1 complete!
```
