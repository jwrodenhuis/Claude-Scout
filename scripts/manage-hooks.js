#!/usr/bin/env node
/**
 * Manage Hooks — Install/uninstall Scout hooks in settings.json
 * Used by install.sh for automated hook registration.
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');
const DEFAULT_SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');

// Note: PostToolUse advisor hook removed — advisor runs on-demand via /scout:eval
const SCOUT_HOOKS = {
  SessionStart: {
    hooks: [{
      type: 'command',
      command: `node "${path.join(CLAUDE_DIR, 'hooks', 'scout-session-start.js')}"`,
      timeout: 3,
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
