#!/usr/bin/env node
/**
 * Session Scout — SessionStart Hook
 * Detects project type, loads skill catalog, and emits a toolkit briefing.
 * Auto-rebuilds catalog if fingerprint changed or index is >24h old.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');
const INDEX_PATH = path.join(CLAUDE_DIR, 'skills', '.index.json');
const CATALOG_BUILDER = path.join(CLAUDE_DIR, 'scripts', 'build-skill-catalog.js');
const DETECTOR = path.join(CLAUDE_DIR, 'scripts', 'project-detector.js');

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  } catch (e) {
    return {};
  }
}

function needsRebuild() {
  if (!fs.existsSync(INDEX_PATH)) return true;

  try {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    const age = Date.now() - new Date(index.generated).getTime();
    if (age > 24 * 60 * 60 * 1000) return true; // >24h

    // Check fingerprint
    const oldFp = index.fingerprint || {};
    const dirs = [
      path.join(CLAUDE_DIR, 'skills'),
      path.join(CLAUDE_DIR, 'agents'),
      path.join(CLAUDE_DIR, 'plugins', 'cache'),
    ];
    for (const d of dirs) {
      try {
        const count = fs.readdirSync(d).length;
        if (count !== oldFp[d]) return true;
      } catch (e) { /* skip */ }
    }
    for (const f of ['settings.json', 'settings.local.json']) {
      try {
        const mtime = fs.statSync(path.join(CLAUDE_DIR, f)).mtimeMs;
        if (Math.abs(mtime - (oldFp[f] || 0)) > 1000) return true;
      } catch (e) { /* skip */ }
    }
    return false;
  } catch (e) {
    return true;
  }
}

function rebuildCatalog() {
  try {
    execSync(`node "${CATALOG_BUILDER}"`, { timeout: 5000, stdio: 'pipe' });
  } catch (e) { /* continue with stale index */ }
}

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function loadProfile(cwd) {
  const profilePath = path.join(cwd, '.claude', 'scout-profile.json');
  try {
    return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

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

  // Dependency matching
  if (project.dependencies && project.dependencies.length > 0) {
    const entryText = `${entry.name || ''} ${entry.description || ''}`.toLowerCase();
    for (const dep of project.dependencies) {
      const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match exact or with hyphens/spaces interchangeable
      const pattern = escaped.replace(/-/g, '(\\s+|-)');
      if (dep.length >= 3 && new RegExp(`\\b${pattern}\\b`).test(entryText)) {
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

function formatBriefing(project, recommendations, profile) {
  const lines = [];
  lines.push(`Toolkit Scout — ${project.language ? project.language.charAt(0).toUpperCase() + project.language.slice(1) : 'Unknown'}${project.framework ? '/' + project.framework.charAt(0).toUpperCase() + project.framework.slice(1) : ''} project (${project.projectName})`);
  lines.push('━'.repeat(60));

  if (profile) {
    const lastDate = profile.lastSession ? new Date(profile.lastSession).toLocaleDateString('nl-NL') : '?';
    lines.push(`Bestaand profiel gevonden (laatste sessie: ${lastDate})`);
    lines.push('');
  }

  // Group by source
  const skills = recommendations.filter(r => r.source === 'skill' || r.source.startsWith('plugin:'));
  const agents = recommendations.filter(r => r.source === 'agent');
  const others = recommendations.filter(r => !['skill', 'agent'].includes(r.source) && !r.source.startsWith('plugin:'));

  if (skills.length > 0) {
    lines.push('Aanbevolen skills:');
    skills.forEach((s, i) => {
      lines.push(` ${i + 1}. ${s.invoke} — ${s.summary || s.description}`);
    });
    lines.push('');
  }

  if (agents.length > 0) {
    lines.push('Aanbevolen agents:');
    agents.forEach((a, i) => {
      lines.push(` ${i + 1}. ${a.name} — ${a.summary || a.description}`);
    });
    lines.push('');
  }

  if (others.length > 0) {
    lines.push('Overige tooling:');
    others.forEach((o, i) => {
      lines.push(` ${i + 1}. ${o.name} (${o.source}) — ${o.summary || o.description}`);
    });
    lines.push('');
  }

  lines.push('Tip: /scout voor volledige scan | /scout:eval voor mid-session evaluatie | /scout:bootstrap voor diepte-analyse');

  return lines.join('\n');
}

function saveProfile(cwd, project, recommendations) {
  const profileDir = path.join(cwd, '.claude');
  const profilePath = path.join(profileDir, 'scout-profile.json');

  let profile = {};
  try {
    profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  } catch (e) { /* new profile */ }

  profile.projectType = {
    language: project.language,
    framework: project.framework,
    database: project.database,
    detectedAt: new Date().toISOString().split('T')[0],
  };
  profile.recommendedTools = recommendations.map(r => ({
    name: r.invoke || r.name,
    type: r.source,
    recommendedAt: new Date().toISOString().split('T')[0],
  }));
  profile.lastSession = new Date().toISOString();
  profile.usedTools = profile.usedTools || [];
  profile.evaluations = profile.evaluations || [];

  try {
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  } catch (e) { /* can't write to project dir, skip */ }
}

// Exports for testing
module.exports = { scoreSkill, formatBriefing, needsRebuild, loadProfile, saveProfile };

// Main
if (require.main === module) {
  const input = readStdin();
  const cwd = input?.cwd || input?.workspace?.current_dir || process.cwd();

  // Auto-rebuild if needed
  if (needsRebuild()) rebuildCatalog();

  const index = loadIndex();
  if (!index) {
    // No catalog, emit nothing
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart' } }));
    process.exit(0);
  }

  // Detect project
  let project;
  try {
    const { detect } = require(DETECTOR);
    project = detect(cwd);
  } catch (e) {
    project = { language: null, languages: [], frameworks: [], projectName: path.basename(cwd) };
  }

  // Load existing profile
  const profile = loadProfile(cwd);

  // Score and rank
  const scored = index.skills
    .map(entry => ({ ...entry, score: scoreSkill(entry, project, profile) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (scored.length === 0) {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart' } }));
    process.exit(0);
  }

  // Save profile
  saveProfile(cwd, project, scored);

  // Emit briefing
  const briefing = formatBriefing(project, scored, profile);
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `<session-scout>\n${briefing}\n</session-scout>`,
    },
  }));
}
