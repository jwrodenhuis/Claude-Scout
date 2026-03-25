const fs = require('fs');
const path = require('path');
const { checkFiles, checkHooks, checkCatalog, REQUIRED_FILES } = require('../scripts/health-check');

const REPO_ROOT = path.join(__dirname, '..');

describe('health-check', () => {
  test('REQUIRED_FILES contains essential files', () => {
    expect(REQUIRED_FILES).toContain('hooks/scout-session-start.js');
    expect(REQUIRED_FILES).toContain('hooks/advisor-post-tool-use.js');
    expect(REQUIRED_FILES).toContain('scripts/build-skill-catalog.js');
    expect(REQUIRED_FILES).toContain('scripts/global-scout.js');
    expect(REQUIRED_FILES).toContain('scripts/online-search.js');
    expect(REQUIRED_FILES).toContain('scripts/i18n.js');
    expect(REQUIRED_FILES).toContain('skills/session-scout/SKILL.md');
    expect(REQUIRED_FILES).toContain('skills/scout:global/SKILL.md');
    expect(REQUIRED_FILES).toContain('skills/scout:eval/SKILL.md');
    expect(REQUIRED_FILES).toContain('skills/scout:bootstrap/SKILL.md');
    expect(REQUIRED_FILES).toContain('skills/scout:help/SKILL.md');
  });

  test('REQUIRED_FILES covers all scripts in scripts/', () => {
    // Guard: any new .js file added to scripts/ must be in REQUIRED_FILES
    // health-check.js is dev-only, runs from repo — not installed to ~/.claude/
    const DEV_ONLY_SCRIPTS = ['health-check.js'];
    const scriptsDir = path.join(REPO_ROOT, 'scripts');
    const allScripts = fs.readdirSync(scriptsDir)
      .filter(f => f.endsWith('.js') && !DEV_ONLY_SCRIPTS.includes(f))
      .map(f => `scripts/${f}`);

    for (const script of allScripts) {
      expect(REQUIRED_FILES).toContain(script);
    }
  });

  test('REQUIRED_FILES covers all SKILL.md files in skills/', () => {
    // Guard: any new skill directory must have its SKILL.md in REQUIRED_FILES
    const skillsDir = path.join(REPO_ROOT, 'skills');
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    for (const dir of skillDirs) {
      const skillMd = `skills/${dir}/SKILL.md`;
      if (fs.existsSync(path.join(skillsDir, dir, 'SKILL.md'))) {
        expect(REQUIRED_FILES).toContain(skillMd);
      }
    }
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
