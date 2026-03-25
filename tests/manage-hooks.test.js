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
      expect(settings.hooks.SessionStart).toHaveLength(1);
      expect(settings.hooks.PostToolUse).toBeDefined();
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
      expect(result.success).toBe(true);
    });
  });

  describe('SCOUT_HOOKS constant', () => {
    test('defines SessionStart and PostToolUse hooks', () => {
      expect(SCOUT_HOOKS.SessionStart).toBeDefined();
      expect(SCOUT_HOOKS.PostToolUse).toBeDefined();
    });
  });
});
