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
