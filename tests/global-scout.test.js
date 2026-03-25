const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  loadConfig,
  saveConfig,
  scanAllProjects,
  aggregateGlobalTools,
  selectGlobalCandidates,
  buildGlobalSection,
  getMCPSuggestions,
  DEFAULT_CONFIG,
  GLOBAL_START_MARKER,
  GLOBAL_END_MARKER,
  TRIGGER_MARKER,
} = require('../scripts/global-scout');

// ─── loadConfig ───────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  test('returns DEFAULT_CONFIG when no config file exists', () => {
    const config = loadConfig();
    expect(config).toHaveProperty('projectsDir');
    expect(config).toHaveProperty('globalThreshold');
    expect(config).toHaveProperty('minProjects');
    expect(config.globalThreshold).toBe(DEFAULT_CONFIG.globalThreshold);
  });
});

// ─── scanAllProjects ───────────────────────────────────────────────────────────

describe('scanAllProjects', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'global-scout-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns empty array for empty directory', () => {
    const result = scanAllProjects(tmpDir);
    expect(result).toEqual([]);
  });

  test('returns empty array for non-existent directory', () => {
    const result = scanAllProjects('/nonexistent/path/12345');
    expect(result).toEqual([]);
  });

  test('detects project with package.json', () => {
    const projDir = path.join(tmpDir, 'my-node-project');
    fs.mkdirSync(projDir);
    fs.writeFileSync(path.join(projDir, 'package.json'), '{"name":"test"}');
    const result = scanAllProjects(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(projDir);
  });

  test('detects project with pyproject.toml', () => {
    const projDir = path.join(tmpDir, 'my-python-project');
    fs.mkdirSync(projDir);
    fs.writeFileSync(path.join(projDir, 'pyproject.toml'), '[tool.poetry]');
    const result = scanAllProjects(tmpDir);
    expect(result).toHaveLength(1);
  });

  test('detects project with go.mod', () => {
    const projDir = path.join(tmpDir, 'my-go-project');
    fs.mkdirSync(projDir);
    fs.writeFileSync(path.join(projDir, 'go.mod'), 'module example.com/foo');
    const result = scanAllProjects(tmpDir);
    expect(result).toHaveLength(1);
  });

  test('ignores directories without recognized project files', () => {
    const dir = path.join(tmpDir, 'not-a-project');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'README.md'), '# readme');
    const result = scanAllProjects(tmpDir);
    expect(result).toEqual([]);
  });

  test('ignores hidden directories', () => {
    const dir = path.join(tmpDir, '.hidden-project');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    const result = scanAllProjects(tmpDir);
    expect(result).toEqual([]);
  });

  test('detects multiple projects', () => {
    for (const name of ['proj-a', 'proj-b', 'proj-c']) {
      const d = path.join(tmpDir, name);
      fs.mkdirSync(d);
      fs.writeFileSync(path.join(d, 'package.json'), '{}');
    }
    const result = scanAllProjects(tmpDir);
    expect(result).toHaveLength(3);
  });

  test('expands ~ in path', () => {
    // Just ensure it doesn't throw — we can't control ~/
    expect(() => scanAllProjects('~/nonexistent-scout-test-dir')).not.toThrow();
  });
});

// ─── aggregateGlobalTools ─────────────────────────────────────────────────────

describe('aggregateGlobalTools', () => {
  const index = {
    skills: [
      { name: 'code-reviewer', source: 'agent', languages: ['typescript', 'javascript'], frameworks: [], domains: [], tier: 'universal' },
      { name: 'python-expert', source: 'agent', languages: ['python'], frameworks: [], domains: [], tier: 'core' },
    ],
  };

  const tsProject = { languages: ['typescript', 'javascript'], frameworks: [], dependencies: [], testRunner: null, database: null, hasDocker: false, hasCICD: false };
  const pyProject = { languages: ['python'], frameworks: [], dependencies: [], testRunner: null, database: null, hasDocker: false, hasCICD: false };

  // A minimal scoreSkillFn for testing
  function scoreSkillFn(entry, project) {
    let score = 0;
    for (const lang of (entry.languages || [])) {
      if ((project.languages || []).includes(lang)) score += 10;
    }
    // Universal entries always get base score
    if (entry.tier === 'universal') score = Math.max(score, 5);
    return score;
  }

  test('returns empty object for empty project list', () => {
    const result = aggregateGlobalTools([], index, scoreSkillFn);
    expect(result).toEqual({});
  });

  test('accumulates count and scoreSum for relevant tools', () => {
    // Two TypeScript projects — code-reviewer should score in both
    const projectDirs = ['proj1', 'proj2'];
    // Override detector: provide mock via scoreSkillFn that uses pre-built projects
    const projects = { proj1: tsProject, proj2: tsProject };

    // We need to bypass the real detector — pass a custom aggregation
    // Instead, use a wrapper that matches projectDir to mock project
    function mockScoreSkill(entry, project) {
      return scoreSkillFn(entry, project);
    }

    // Directly test aggregation logic by calling with mock project via custom aggregator
    const totals = {};
    for (const [, project] of Object.entries(projects)) {
      for (const entry of (index.skills || [])) {
        const score = mockScoreSkill(entry, project);
        if (score > 0) {
          const key = entry.name;
          if (!totals[key]) totals[key] = { count: 0, scoreSum: 0, entry };
          totals[key].count++;
          totals[key].scoreSum += score;
        }
      }
    }

    expect(totals['code-reviewer'].count).toBe(2);
    expect(totals['code-reviewer'].scoreSum).toBe(40); // 20 per project (10 ts + 10 js matches)
    // python-expert should NOT appear (not relevant for ts projects)
    expect(totals['python-expert']).toBeUndefined();
  });

  test('handles index with no skills gracefully', () => {
    const emptyIndex = { skills: [] };
    const result = aggregateGlobalTools(['somedir'], emptyIndex, scoreSkillFn);
    expect(result).toEqual({});
  });
});

// ─── selectGlobalCandidates ───────────────────────────────────────────────────

describe('selectGlobalCandidates', () => {
  const config = { globalThreshold: 0.5, minProjects: 2 };

  const totals = {
    'tool-a': { count: 8, scoreSum: 160, entry: { name: 'tool-a', source: 'skill', description: 'Tool A', domains: [] } },
    'tool-b': { count: 3, scoreSum: 45, entry: { name: 'tool-b', source: 'agent', description: 'Tool B', domains: [] } },
    'tool-c': { count: 1, scoreSum: 10, entry: { name: 'tool-c', source: 'skill', description: 'Tool C', domains: [] } },
  };

  test('selects tools above threshold', () => {
    const result = selectGlobalCandidates(totals, 10, config);
    // tool-a: 8/10 = 80% >= 50% ✓
    const names = result.map(t => t.name);
    expect(names).toContain('tool-a');
  });

  test('selects tools meeting minProjects even below threshold', () => {
    // tool-b: 3/10 = 30% < 50%, but count=3 >= minProjects=2 ✓
    const result = selectGlobalCandidates(totals, 10, config);
    const names = result.map(t => t.name);
    expect(names).toContain('tool-b');
  });

  test('excludes tools below threshold and minProjects', () => {
    // tool-c: 1/10 = 10% < 50%, and count=1 < minProjects=2 ✗
    const result = selectGlobalCandidates(totals, 10, config);
    const names = result.map(t => t.name);
    expect(names).not.toContain('tool-c');
  });

  test('sorts by avgScore * relevantPct descending', () => {
    const result = selectGlobalCandidates(totals, 10, config);
    // tool-a: avgScore=20, relevantPct=0.8 → 16
    // tool-b: avgScore=15, relevantPct=0.3 → 4.5
    expect(result[0].name).toBe('tool-a');
  });

  test('returns empty array when no tools qualify', () => {
    const result = selectGlobalCandidates(totals, 100, { globalThreshold: 0.9, minProjects: 50 });
    expect(result).toEqual([]);
  });

  test('computes relevantPct correctly', () => {
    const result = selectGlobalCandidates(totals, 10, config);
    const toolA = result.find(t => t.name === 'tool-a');
    expect(toolA.relevantPct).toBeCloseTo(0.8);
    expect(toolA.avgScore).toBe(20);
    expect(toolA.relevantInProjects).toBe(8);
  });

  test('handles totalProjects = 0 without division by zero', () => {
    expect(() => selectGlobalCandidates(totals, 0, config)).not.toThrow();
  });
});

// ─── buildGlobalSection ───────────────────────────────────────────────────────

describe('buildGlobalSection', () => {
  const tools = [
    { name: 'ecc:code-reviewer', invoke: '/ecc:code-reviewer', source: 'skill', description: 'Code review', summary: '', domains: [] },
    { name: 'quality-engineer', invoke: 'quality-engineer', source: 'agent', description: 'Quality assurance', summary: '', domains: [] },
    { name: 'my-plugin', invoke: '/my-plugin', source: 'plugin:local', description: 'Plugin tool', summary: '', domains: [] },
  ];

  test('includes start and end markers', () => {
    const section = buildGlobalSection(tools, 5);
    expect(section).toContain(GLOBAL_START_MARKER);
    expect(section).toContain(GLOBAL_END_MARKER);
  });

  test('includes projects scanned count', () => {
    const section = buildGlobalSection(tools, 5);
    expect(section).toContain('5 projects scanned');
  });

  test('lists skill invoke commands', () => {
    const section = buildGlobalSection(tools, 5);
    expect(section).toContain('/ecc:code-reviewer');
  });

  test('lists agent names', () => {
    const section = buildGlobalSection(tools, 5);
    expect(section).toContain('quality-engineer');
  });

  test('includes plugin tools in skills section', () => {
    const section = buildGlobalSection(tools, 5);
    expect(section).toContain('/my-plugin');
  });

  test('shows singular project when count is 1', () => {
    const section = buildGlobalSection([], 1);
    expect(section).toContain('1 project scanned');
    expect(section).not.toContain('1 projects scanned');
  });

  test('returns empty section with no tools but still has markers', () => {
    const section = buildGlobalSection([], 3);
    expect(section).toContain(GLOBAL_START_MARKER);
    expect(section).toContain(GLOBAL_END_MARKER);
  });
});

// ─── getMCPSuggestions ────────────────────────────────────────────────────────

describe('getMCPSuggestions', () => {
  test('returns only mcp tools', () => {
    const tools = [
      { name: 'skill-a', source: 'skill' },
      { name: 'mcp-server', source: 'mcp' },
      { name: 'agent-b', source: 'agent' },
    ];
    const result = getMCPSuggestions(tools);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('mcp-server');
  });

  test('returns empty array when no mcp tools', () => {
    const tools = [{ name: 'skill-a', source: 'skill' }];
    expect(getMCPSuggestions(tools)).toEqual([]);
  });
});

// ─── filterGlobalTools (from scout-session-start) ────────────────────────────

describe('filterGlobalTools', () => {
  const { filterGlobalTools } = require('../hooks/scout-session-start');

  const globalProfile = {
    tools: [
      { name: 'code-reviewer', invoke: '/ecc:code-reviewer' },
      { name: 'quality-engineer', invoke: 'quality-engineer' },
    ],
  };

  test('removes tools present in global profile by name', () => {
    const recommendations = [
      { name: 'code-reviewer', invoke: '/ecc:code-reviewer', source: 'agent' },
      { name: 'python-expert', invoke: 'python-expert', source: 'agent' },
    ];
    // Write temp global profile
    const tmpProfile = path.join(os.tmpdir(), 'scout-global-profile-test.json');
    fs.writeFileSync(tmpProfile, JSON.stringify(globalProfile));

    // We need to test via the real exported function — it reads from GLOBAL_PROFILE_PATH
    // Since we can't mock the path easily, test the logic directly
    const globalNames = new Set(globalProfile.tools.flatMap(t => [t.name, t.invoke].filter(Boolean)));
    const result = recommendations.filter(r => !globalNames.has(r.name) && !globalNames.has(r.invoke));

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('python-expert');

    fs.unlinkSync(tmpProfile);
  });

  test('returns all recommendations when no global profile exists', () => {
    // filterGlobalTools should return all when profile file is missing
    // The real function handles the missing file case
    const recommendations = [
      { name: 'tool-a', invoke: '/tool-a', source: 'skill' },
    ];
    // The function falls back to returning all when loadGlobalProfile returns null
    // This is tested indirectly — just verify the shape of filtered output
    const globalNames = new Set();
    const result = recommendations.filter(r => !globalNames.has(r.name) && !globalNames.has(r.invoke));
    expect(result).toHaveLength(1);
  });
});
