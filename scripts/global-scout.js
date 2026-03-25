#!/usr/bin/env node
/**
 * Global Scout — aggregates tool relevance across all projects.
 * Identifies helpers that are useful in most projects and writes them
 * to the global ~/.claude/CLAUDE.md so they are available everywhere.
 *
 * Usage: node global-scout.js [--projects-dir <dir>] [--threshold <0-1>]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CONFIG_PATH = path.join(CLAUDE_DIR, 'scout-config.json');
const GLOBAL_PROFILE_PATH = path.join(CLAUDE_DIR, 'scout-global-profile.json');
const GLOBAL_CLAUDE_MD = path.join(CLAUDE_DIR, 'CLAUDE.md');
const INDEX_PATH = path.join(CLAUDE_DIR, 'skills', '.index.json');

const GLOBAL_START_MARKER = '<!-- scout:global:start -->';
const GLOBAL_END_MARKER = '<!-- scout:global:end -->';
const TRIGGER_MARKER = '<!-- scout:trigger -->';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  projectsDir: path.join(os.homedir(), 'projects'),
  globalThreshold: 0.4,   // 40% of projects must find it relevant
  minProjects: 2,          // or at minimum this many projects
};

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    // Expand ~ in projectsDir
    if (raw.projectsDir && raw.projectsDir.startsWith('~')) {
      raw.projectsDir = path.join(os.homedir(), raw.projectsDir.slice(2));
    }
    return { ...DEFAULT_CONFIG, ...raw };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    process.stderr.write(`Scout: could not write config: ${e.message}\n`);
  }
}

// ─── Project scanning ─────────────────────────────────────────────────────────

/**
 * Returns list of immediate subdirectories that look like projects.
 */
function scanAllProjects(projectsDir) {
  const expanded = projectsDir.startsWith('~')
    ? path.join(os.homedir(), projectsDir.slice(2))
    : projectsDir;

  try {
    const entries = fs.readdirSync(expanded, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => path.join(expanded, e.name))
      .filter(dir => {
        // Must have at least one recognizable project file
        const indicators = [
          'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py',
          'Cargo.toml', 'go.mod', 'Gemfile', 'pom.xml', 'build.gradle',
          'Package.swift',
        ];
        return indicators.some(f => fs.existsSync(path.join(dir, f)));
      });
  } catch (e) {
    process.stderr.write(`Scout: could not scan projects dir ${expanded}: ${e.message}\n`);
    return [];
  }
}

// ─── Index loading ────────────────────────────────────────────────────────────

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Score all tools across all detected project profiles.
 * Returns aggregated relevance per tool.
 */
function aggregateGlobalTools(projectDirs, index, scoreSkillFn) {
  const totals = {}; // name → { count, scoreSum, entry }

  for (const dir of projectDirs) {
    let project;
    try {
      const { detect } = require(path.join(__dirname, 'project-detector'));
      project = detect(dir);
    } catch (e) {
      continue;
    }

    for (const entry of (index.skills || [])) {
      const score = scoreSkillFn(entry, project, null);
      if (score > 0) {
        const key = entry.name;
        if (!totals[key]) {
          totals[key] = { count: 0, scoreSum: 0, entry };
        }
        totals[key].count++;
        totals[key].scoreSum += score;
      }
    }
  }

  return totals;
}

/**
 * Filter aggregated totals to tools that meet the global threshold.
 */
function selectGlobalCandidates(totals, totalProjects, config) {
  const { globalThreshold, minProjects } = config;

  return Object.values(totals)
    .map(({ count, scoreSum, entry }) => ({
      name: entry.name,
      invoke: entry.invoke || entry.name,
      source: entry.source,
      description: entry.description || '',
      summary: entry.summary || '',
      domains: entry.domains || [],
      relevantInProjects: count,
      relevantPct: totalProjects > 0 ? count / totalProjects : 0,
      avgScore: count > 0 ? Math.round(scoreSum / count) : 0,
    }))
    .filter(t => t.relevantPct >= globalThreshold || t.relevantInProjects >= minProjects)
    .sort((a, b) => b.avgScore * b.relevantPct - a.avgScore * a.relevantPct);
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function loadGlobalProfile() {
  try {
    return JSON.parse(fs.readFileSync(GLOBAL_PROFILE_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveGlobalProfile(profile) {
  try {
    fs.writeFileSync(GLOBAL_PROFILE_PATH, JSON.stringify(profile, null, 2));
  } catch (e) {
    process.stderr.write(`Scout: could not write global profile: ${e.message}\n`);
  }
}

// ─── CLAUDE.md writing ────────────────────────────────────────────────────────

function buildGlobalSection(tools, projectsScanned) {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const skills = tools.filter(t => t.source === 'skill' || (t.source && t.source.startsWith('plugin:')));
  const agents = tools.filter(t => t.source === 'agent');
  const others = tools.filter(t => !['skill', 'agent'].includes(t.source) && !(t.source && t.source.startsWith('plugin:')));

  const lines = [
    GLOBAL_START_MARKER,
    `## Global Scout`,
    `*Updated: ${date} — ${projectsScanned} project${projectsScanned !== 1 ? 's' : ''} scanned*`,
    '',
    'These tools are relevant across most of your projects and are available in every session.',
    '',
  ];

  if (skills.length > 0) {
    lines.push('**Skills — invoke when relevant:**');
    skills.forEach(s => {
      const trigger = getTriggerText(s.name, s.description);
      lines.push(`- \`${s.invoke}\` — ${trigger}`);
    });
    lines.push('');
  }

  if (agents.length > 0) {
    lines.push('**Agents — launch proactively:**');
    agents.forEach(a => {
      const trigger = getTriggerText(a.name, a.description);
      lines.push(`- \`${a.name}\` — ${trigger}`);
    });
    lines.push('');
  }

  if (others.length > 0) {
    lines.push('**Other tooling:**');
    others.forEach(o => {
      lines.push(`- \`${o.invoke || o.name}\` (${o.source}) — ${o.summary || o.description}`);
    });
    lines.push('');
  }

  lines.push(GLOBAL_END_MARKER);
  return lines.join('\n');
}

function getTriggerText(name, description) {
  const text = (name + ' ' + (description || '')).toLowerCase();
  if (text.includes('tdd') || text.includes('test-driven')) return 'use when writing new features or fixing bugs';
  if (text.includes('security')) return 'use when handling auth, input validation, or APIs';
  if (text.includes('code-review') || text.includes('code reviewer')) return 'use after significant code changes';
  if (text.includes('refactor')) return 'use when cleaning up or restructuring code';
  if (text.includes('database') || text.includes('sql')) return 'use when writing queries or schema changes';
  if (text.includes('debug')) return 'use when investigating bugs';
  if (text.includes('api-design') || text.includes('api design')) return 'use when designing or reviewing API endpoints';
  if (text.includes('build-error') || text.includes('build error')) return 'use when build or type errors occur';
  return 'use when relevant';
}

const TRIGGER_SECTION = `${TRIGGER_MARKER}
## Project Initialization

When the user describes what they want to build or the goals of a new project,
invoke \`/scout\` immediately to identify project-specific helpers.
${TRIGGER_MARKER}`;

/**
 * Write the global section to ~/.claude/CLAUDE.md.
 * Preserves all other content. Adds trigger instruction if not present.
 */
function applyGlobalSection(tools, projectsScanned) {
  const section = buildGlobalSection(tools, projectsScanned);

  let content = '';
  try {
    content = fs.readFileSync(GLOBAL_CLAUDE_MD, 'utf8');
  } catch (e) { /* file doesn't exist yet */ }

  // Replace or append global section
  const startIdx = content.indexOf(GLOBAL_START_MARKER);
  const endIdx = content.indexOf(GLOBAL_END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    content = content.slice(0, startIdx) + section + content.slice(endIdx + GLOBAL_END_MARKER.length);
  } else {
    const separator = content.length > 0 && !content.endsWith('\n\n') ? '\n\n' : '';
    content = content + separator + section;
  }

  // Add trigger instruction if not already present
  if (!content.includes(TRIGGER_MARKER)) {
    content = content + '\n\n' + TRIGGER_SECTION;
  }

  try {
    fs.writeFileSync(GLOBAL_CLAUDE_MD, content);
  } catch (e) {
    process.stderr.write(`Scout: could not write ${GLOBAL_CLAUDE_MD}: ${e.message}\n`);
  }
}

/**
 * Identify MCP server candidates from global tools (for suggestion only, not auto-install).
 */
function getMCPSuggestions(tools) {
  return tools.filter(t => t.source === 'mcp');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  loadConfig,
  saveConfig,
  scanAllProjects,
  loadIndex,
  aggregateGlobalTools,
  selectGlobalCandidates,
  loadGlobalProfile,
  saveGlobalProfile,
  applyGlobalSection,
  buildGlobalSection,
  getMCPSuggestions,
  DEFAULT_CONFIG,
  GLOBAL_START_MARKER,
  GLOBAL_END_MARKER,
  TRIGGER_MARKER,
};

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse CLI args
  const dirIdx = args.indexOf('--projects-dir');
  const threshIdx = args.indexOf('--threshold');
  const cliProjectsDir = dirIdx !== -1 ? args[dirIdx + 1] : null;
  const cliThreshold = threshIdx !== -1 ? parseFloat(args[threshIdx + 1]) : null;

  const config = loadConfig();
  if (cliProjectsDir) config.projectsDir = cliProjectsDir;
  if (cliThreshold !== null && !isNaN(cliThreshold)) config.globalThreshold = cliThreshold;

  const index = loadIndex();
  if (!index) {
    process.stderr.write('Scout: no skill index found. Run build-skill-catalog.js first.\n');
    process.exit(1);
  }

  // Need scoreSkill from scout-session-start
  const { scoreSkill } = require(path.join(__dirname, '..', 'hooks', 'scout-session-start'));

  const projectDirs = scanAllProjects(config.projectsDir);
  if (projectDirs.length === 0) {
    process.stderr.write(`Scout: no projects found in ${config.projectsDir}\n`);
    process.exit(0);
  }

  console.log(`Scanning ${projectDirs.length} projects in ${config.projectsDir}...`);

  const totals = aggregateGlobalTools(projectDirs, index, scoreSkill);
  const globalTools = selectGlobalCandidates(totals, projectDirs.length, config);

  console.log(`\nFound ${globalTools.length} globally relevant tools (threshold: ${Math.round(config.globalThreshold * 100)}% of projects):\n`);

  const skills = globalTools.filter(t => t.source === 'skill' || (t.source && t.source.startsWith('plugin:')));
  const agents = globalTools.filter(t => t.source === 'agent');
  const others = globalTools.filter(t => !['skill', 'agent'].includes(t.source) && !(t.source && t.source.startsWith('plugin:')));

  if (skills.length > 0) {
    console.log('Skills:');
    skills.forEach(s => console.log(`  ${s.invoke} — ${s.relevantInProjects}/${projectDirs.length} projects (avg score: ${s.avgScore})`));
  }
  if (agents.length > 0) {
    console.log('\nAgents:');
    agents.forEach(a => console.log(`  ${a.name} — ${a.relevantInProjects}/${projectDirs.length} projects (avg score: ${a.avgScore})`));
  }
  if (others.length > 0) {
    console.log('\nOther:');
    others.forEach(o => console.log(`  ${o.invoke || o.name} (${o.source}) — ${o.relevantInProjects}/${projectDirs.length} projects`));
  }

  // MCP suggestions
  const mcpSuggestions = getMCPSuggestions(globalTools);
  if (mcpSuggestions.length > 0) {
    console.log('\nMCP servers to consider adding to ~/.claude/settings.json:');
    mcpSuggestions.forEach(m => console.log(`  ${m.name} — ${m.summary || m.description}`));
  }

  // Save profile
  const profile = {
    generatedAt: new Date().toISOString(),
    projectsDir: config.projectsDir,
    projectsScanned: projectDirs.length,
    tools: globalTools,
  };
  saveGlobalProfile(profile);
  console.log(`\nGlobal profile saved to ${GLOBAL_PROFILE_PATH}`);

  // Write to CLAUDE.md
  applyGlobalSection(globalTools, projectDirs.length);
  console.log(`Global section written to ${GLOBAL_CLAUDE_MD}`);
}
