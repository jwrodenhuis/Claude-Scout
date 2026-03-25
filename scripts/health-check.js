#!/usr/bin/env node
/**
 * Health Check — Verify Claude Scout installation
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');

const REQUIRED_FILES = [
  'scripts/build-skill-catalog.js',
  'scripts/project-detector.js',
  'scripts/manage-hooks.js',
  'hooks/scout-session-start.js',
  'hooks/advisor-post-tool-use.js',
  'skills/session-scout/SKILL.md',
  'skills/session-scout/GUIDE.md',
  'skills/scout:eval/SKILL.md',
  'skills/scout:bootstrap/SKILL.md',
  'skills/scout:help/SKILL.md',
];

function checkFiles() {
  const results = [];
  for (const f of REQUIRED_FILES) {
    const full = path.join(CLAUDE_DIR, f);
    results.push({ file: f, exists: fs.existsSync(full) });
  }
  return results;
}

function checkHooks() {
  const settingsPath = path.join(CLAUDE_DIR, 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const hooks = settings.hooks || {};
    const hasSessionStart = (hooks.SessionStart || []).some(h =>
      (h.hooks || []).some(hh => (hh.command || '').includes('scout-session-start'))
    );
    const hasPostToolUse = (hooks.PostToolUse || []).some(h =>
      (h.hooks || []).some(hh => (hh.command || '').includes('advisor-post-tool-use'))
    );
    return { SessionStart: hasSessionStart, PostToolUse: hasPostToolUse };
  } catch (e) {
    return { SessionStart: false, PostToolUse: false, error: e.message };
  }
}

function checkCatalog() {
  const indexPath = path.join(CLAUDE_DIR, 'skills', '.index.json');
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const age = Date.now() - new Date(index.generated).getTime();
    const ageHours = Math.round(age / (60 * 60 * 1000));
    return { exists: true, entries: index.totalCount, ageHours, fresh: age < 24 * 60 * 60 * 1000 };
  } catch (e) {
    return { exists: false };
  }
}

function runHealthCheck() {
  const files = checkFiles();
  const hooks = checkHooks();
  const catalog = checkCatalog();

  const missingFiles = files.filter(f => !f.exists);
  const allHooksOk = hooks.SessionStart && hooks.PostToolUse;
  const healthy = missingFiles.length === 0 && allHooksOk && catalog.exists && catalog.fresh;

  return { healthy, files, hooks, catalog, missingFiles };
}

module.exports = { checkFiles, checkHooks, checkCatalog, runHealthCheck, REQUIRED_FILES };

if (require.main === module) {
  const result = runHealthCheck();

  console.log('Claude Scout Health Check');
  console.log('━'.repeat(40));

  console.log('\nFiles:');
  for (const f of result.files) {
    console.log(`  ${f.exists ? '✓' : '✗'} ${f.file}`);
  }

  console.log('\nHooks:');
  console.log(`  ${result.hooks.SessionStart ? '✓' : '✗'} SessionStart`);
  console.log(`  ${result.hooks.PostToolUse ? '✓' : '✗'} PostToolUse`);

  console.log('\nCatalog:');
  if (result.catalog.exists) {
    console.log(`  ✓ ${result.catalog.entries} entries, ${result.catalog.ageHours}h old${result.catalog.fresh ? '' : ' (stale!)'}`);
  } else {
    console.log('  ✗ Not found');
  }

  console.log(`\nStatus: ${result.healthy ? 'HEALTHY' : 'ISSUES FOUND'}`);
  process.exit(result.healthy ? 0 : 1);
}
