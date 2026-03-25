// Force English strings in tests regardless of system locale
process.env.SCOUT_LANG = 'en';

const { scoreSkill, formatBriefing } = require('../hooks/scout-session-start');

describe('scout-session-start', () => {
  describe('scoreSkill', () => {
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

    test('scores language match at +10', () => {
      const entry = { languages: ['typescript'], frameworks: [], domains: [], source: 'skill' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThanOrEqual(10);
    });

    test('scores framework match at +15', () => {
      const entry = { languages: ['typescript'], frameworks: ['next'], domains: [], source: 'skill' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThanOrEqual(25);
    });

    test('scores domain match when lang matches', () => {
      const entry = { languages: ['typescript'], frameworks: [], domains: ['testing'], source: 'skill' };
      const score = scoreSkill(entry, makeProject(), null);
      expect(score).toBeGreaterThanOrEqual(10);
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
      expect(scoreMax).toBe(scoreFive);
    });

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

    test('scores dependency match', () => {
      const entry = { languages: ['typescript'], frameworks: [], domains: [], source: 'skill', tier: 'core', name: 'drizzle-patterns', description: 'Drizzle ORM patterns' };
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
  });

  describe('formatBriefing', () => {
    test('groups skills and agents separately', () => {
      const project = { language: 'typescript', framework: 'next', projectName: 'test' };
      const recs = [
        { name: 'skill1', source: 'skill', invoke: '/skill1', summary: 'A skill' },
        { name: 'agent1', source: 'agent', invoke: 'agent:agent1', summary: 'An agent' },
      ];
      const result = formatBriefing(project, recs, null);
      expect(result).toContain('Recommended skills:');
      expect(result).toContain('Recommended agents:');
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
      expect(result).toContain('Existing profile found');
    });
  });

  describe('applyRecommendations', () => {
    const { applyRecommendations, buildScoutSection, getUsageTrigger } = require('../hooks/scout-session-start');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const makeProject = () => ({ language: 'javascript', framework: null, projectName: 'test' });
    const makeRecs = () => [
      { name: 'tdd-workflow', source: 'plugin:1.8.0', invoke: '/tdd-workflow', description: 'TDD workflow skill', summary: 'TDD' },
      { name: 'code-reviewer', source: 'agent', invoke: 'agent:code-reviewer', description: 'Code reviewer agent', summary: 'Reviews code' },
    ];

    test('creates CLAUDE.md with scout section when file does not exist', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-apply-'));
      applyRecommendations(tmpDir, makeRecs(), makeProject());
      const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('<!-- scout:start -->');
      expect(content).toContain('<!-- scout:end -->');
      expect(content).toContain('Scout Recommendations');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('appends scout section to existing CLAUDE.md', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-apply-'));
      fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Mijn Project\n\nBestaande content.\n');
      applyRecommendations(tmpDir, makeRecs(), makeProject());
      const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('Mijn Project');
      expect(content).toContain('Bestaande content.');
      expect(content).toContain('<!-- scout:start -->');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('replaces existing scout section without duplicating', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-apply-'));
      fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Project\n\n## Scout Recommendations\n<!-- scout:start -->\nold advice\n<!-- scout:end -->\n');
      applyRecommendations(tmpDir, makeRecs(), makeProject());
      const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
      expect(content).not.toContain('old advice');
      expect((content.match(/scout:start/g) || []).length).toBe(1);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('includes skills with trigger context', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-apply-'));
      applyRecommendations(tmpDir, makeRecs(), makeProject());
      const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('/tdd-workflow');
      expect(content).toContain('new features');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('includes agents with trigger context', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-apply-'));
      applyRecommendations(tmpDir, makeRecs(), makeProject());
      const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('code-reviewer');
      expect(content).toContain('significant code changes');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('getUsageTrigger returns correct triggers', () => {
      expect(getUsageTrigger('tdd-workflow', 'TDD skill')).toContain('features');
      expect(getUsageTrigger('security-review', 'Security scan')).toContain('auth');
      expect(getUsageTrigger('code-reviewer', 'Review code')).toContain('significant code changes');
      expect(getUsageTrigger('unknown-tool', 'Some tool')).toBe('use when relevant');
    });

    test('handles write error gracefully without throwing', () => {
      // Read-only path should not throw
      expect(() => applyRecommendations('/nonexistent/readonly', makeRecs(), makeProject())).not.toThrow();
    });
  });

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
});
