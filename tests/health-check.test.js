const { checkFiles, checkHooks, checkCatalog, REQUIRED_FILES } = require('../scripts/health-check');

describe('health-check', () => {
  test('REQUIRED_FILES contains essential files', () => {
    expect(REQUIRED_FILES).toContain('hooks/scout-session-start.js');
    expect(REQUIRED_FILES).toContain('hooks/advisor-post-tool-use.js');
    expect(REQUIRED_FILES).toContain('scripts/build-skill-catalog.js');
    expect(REQUIRED_FILES).toContain('skills/session-scout/SKILL.md');
  });

  test('checkFiles returns array of results', () => {
    const results = checkFiles();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(REQUIRED_FILES.length);
    results.forEach(r => {
      expect(r).toHaveProperty('file');
      expect(r).toHaveProperty('exists');
    });
  });

  test('checkHooks returns hook status', () => {
    const result = checkHooks();
    expect(result).toHaveProperty('SessionStart');
    expect(result).toHaveProperty('PostToolUse');
  });

  test('checkCatalog returns catalog status', () => {
    const result = checkCatalog();
    expect(result).toHaveProperty('exists');
  });
});
