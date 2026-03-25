#!/usr/bin/env node
/**
 * Skill Catalog Builder
 * Scans all skills, agents, plugins, hooks, and MCP servers
 * and builds an indexed .index.json for the Session Scout.
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');
const INDEX_PATH = path.join(CLAUDE_DIR, 'skills', '.index.json');

// Tag inference dictionaries
const LANG_KEYWORDS = {
  python: ['python', 'pip install', 'pypi', 'pytest', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'pep 8', 'pyproject'],
  typescript: ['typescript', ' tsx ', 'tsconfig', 'type-safe', 'ts-node'],
  javascript: ['javascript', ' jsx ', 'node.js', 'npm install', 'deno', 'bun '],
  rust: ['rust', 'cargo', 'crate', 'tokio', 'actix'],
  go: ['golang', 'goroutine', 'gomod', 'go module', 'go build'],
  java: ['java', 'jvm', 'spring', 'maven', 'gradle', 'junit'],
  ruby: ['ruby', 'rails', 'gem', 'rspec', 'bundler'],
  'c++': ['c++', 'cpp', 'cmake', 'clang', 'gcc'],
  swift: ['swift', 'swiftui', 'xcode', 'ios', 'macos'],
};

const DOMAIN_KEYWORDS = {
  testing: ['test', 'tdd', 'spec', 'coverage', 'jest', 'pytest', 'vitest', 'mocha', 'e2e', 'playwright', 'cypress'],
  security: ['security', 'auth', 'owasp', 'vulnerabilit', 'injection', 'xss', 'csrf', 'encrypt', 'secret'],
  api: ['api', 'rest', 'endpoint', 'graphql', 'grpc', 'openapi', 'swagger'],
  database: ['database', 'sql ', 'postgres', 'mysql', 'mongo', 'redis', 'orm ', 'migration', 'schema design', 'query optimization'],
  frontend: ['frontend', 'react', 'vue.js', 'svelte', 'tailwind', 'next.js', 'component design'],
  backend: ['backend', 'server-side', 'middleware', 'microservice', 'express.js', 'fastapi', 'django'],
  devops: ['docker', 'kubernetes', 'ci/cd', 'deployment', 'terraform', 'ansible', 'helm chart'],
  'data-science': ['machine learning', 'pandas', 'numpy', 'scipy', 'jupyter notebook', 'scikit-learn', 'deep learning'],
  documentation: ['documentation', 'readme', 'technical writing'],
  git: ['git commit', 'git branch', 'pull request', 'git rebase'],
  refactoring: ['refactor', 'cleanup', 'dead code', 'lint', 'format', 'consolidat'],
  planning: ['plan', 'roadmap', 'milestone', 'phase', 'workflow', 'orchestrat'],
};

const FRAMEWORK_KEYWORDS = {
  next: ['next.js', 'nextjs', 'next'],
  react: ['react', 'jsx', 'tsx', 'hooks', 'useState', 'useEffect'],
  vue: ['vue', 'vuex', 'nuxt', 'pinia'],
  django: ['django', 'drf'],
  fastapi: ['fastapi'],
  flask: ['flask'],
  express: ['express'],
  spring: ['spring', 'springboot', 'spring boot'],
  rails: ['rails', 'ruby on rails'],
  docker: ['docker', 'dockerfile', 'compose'],
};

const NICHE_KEYWORDS = [
  'genomics', 'molecular', 'quantum', 'spectral', 'protein', 'metabol',
  'phylogenet', 'biosignal', 'crystallograph', 'astro', 'pathology',
  'docking', 'cheminformat', 'bioinformat', 'single-cell', 'sequencing',
];

const UNIVERSAL_DOMAINS = ['git', 'planning', 'refactoring', 'documentation'];

function inferTags(text) {
  const lower = ` ${(text || '').toLowerCase()} `;
  const tags = new Set();
  const languages = new Set();
  const frameworks = new Set();
  const domains = new Set();

  // Use word-boundary-aware matching to avoid false positives
  const wordMatch = (kw) => {
    // For multi-word keywords, simple includes is fine
    if (kw.includes(' ') || kw.includes('.') || kw.includes('-') || kw.includes('/')) return lower.includes(kw);
    // For single words, require word boundaries
    return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower);
  };

  for (const [lang, keywords] of Object.entries(LANG_KEYWORDS)) {
    if (keywords.some(kw => wordMatch(kw))) languages.add(lang);
  }
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => wordMatch(kw))) domains.add(domain);
  }
  for (const [fw, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    if (keywords.some(kw => wordMatch(kw))) frameworks.add(fw);
  }

  // Tier classification
  const isNiche = NICHE_KEYWORDS.some(kw => lower.includes(kw));
  const hasLang = languages.size > 0;
  const onlyUniversalDomains = domains.size > 0 && [...domains].every(d => UNIVERSAL_DOMAINS.includes(d));
  let tier = 'core';
  if (isNiche) tier = 'niche';
  else if (!hasLang && (onlyUniversalDomains || domains.size === 0)) tier = 'universal';

  return {
    tags: [...languages, ...domains, ...frameworks],
    languages: [...languages],
    frameworks: [...frameworks],
    domains: [...domains],
    tier,
  };
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*["']?(.+?)["']?\s*$/);
    if (m) fm[m[1]] = m[2];
  }
  return fm;
}

function summarize(description, maxLen = 120) {
  if (!description) return '';
  const clean = description.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen - 3) + '...';
}

function scanSkills() {
  const skillsDir = path.join(CLAUDE_DIR, 'skills');
  const entries = [];
  if (!fs.existsSync(skillsDir)) return entries;

  for (const dir of fs.readdirSync(skillsDir)) {
    const skillFile = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    try {
      const content = fs.readFileSync(skillFile, 'utf8');
      const fm = parseFrontmatter(content);
      const tagInfo = inferTags(`${fm.name || dir} ${fm.description || ''}`);
      // Scientific skills from K-Dense are Python-only unless explicitly stated otherwise
      const isScientific = fs.existsSync(path.join(skillsDir, dir, 'references')) ||
        (fm.metadata && String(fm.metadata).includes('K-Dense')) ||
        (fm.license && fm.license.includes('K-Dense'));
      if (isScientific && !tagInfo.languages.includes('python')) {
        tagInfo.languages.push('python');
        tagInfo.tags.push('python');
      }
      entries.push({
        name: fm.name || dir,
        source: 'skill',
        description: fm.description || '',
        summary: summarize(fm.description),
        invoke: `/${fm.name || dir}`,
        ...tagInfo,
      });
    } catch (e) { process.stderr.write(`Warning: cannot read skill ${dir}: ${e.message}\n`); }
  }
  return entries;
}

function scanAgents() {
  const agentsDir = path.join(CLAUDE_DIR, 'agents');
  const entries = [];
  if (!fs.existsSync(agentsDir)) return entries;

  for (const file of fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'))) {
    try {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      const fm = parseFrontmatter(content);
      const name = fm.name || file.replace('.md', '');
      const tagInfo = inferTags(`${name} ${fm.description || ''} ${content.substring(0, 500)}`);
      entries.push({
        name,
        source: 'agent',
        description: fm.description || '',
        summary: summarize(fm.description),
        invoke: `agent:${name}`,
        ...tagInfo,
      });
    } catch (e) { process.stderr.write(`Warning: cannot read agent ${file}: ${e.message}\n`); }
  }
  return entries;
}

function scanPluginSkills() {
  const cacheDir = path.join(CLAUDE_DIR, 'plugins', 'cache');
  const entries = [];
  if (!fs.existsSync(cacheDir)) return entries;

  function walk(dir, depth = 0) {
    if (depth > 5) return;
    try {
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (item === 'skills') {
            // Scan plugin skill directories
            for (const skillDir of fs.readdirSync(full)) {
              const skillFile = path.join(full, skillDir, 'SKILL.md');
              if (fs.existsSync(skillFile)) {
                try {
                  const content = fs.readFileSync(skillFile, 'utf8');
                  const fm = parseFrontmatter(content);
                  const pluginName = dir.split(path.sep).slice(-2, -1)[0] || 'plugin';
                  const tagInfo = inferTags(`${fm.name || skillDir} ${fm.description || ''} ${content.substring(0, 500)}`);
                  entries.push({
                    name: fm.name || skillDir,
                    source: `plugin:${pluginName}`,
                    description: fm.description || '',
                    summary: summarize(fm.description),
                    invoke: `/${fm.name || skillDir}`,
                    ...tagInfo,
                  });
                } catch (e) { process.stderr.write(`Warning: cannot read plugin skill ${skillDir}: ${e.message}\n`); }
              }
            }
          } else {
            walk(full, depth + 1);
          }
        }
      }
    } catch (e) { /* skip */ }
  }
  walk(cacheDir);
  return entries;
}

function scanGSDWorkflows() {
  const gsdDir = path.join(CLAUDE_DIR, 'get-shit-done', 'workflows');
  const entries = [];
  if (!fs.existsSync(gsdDir)) return entries;

  for (const file of fs.readdirSync(gsdDir).filter(f => f.endsWith('.md'))) {
    try {
      const content = fs.readFileSync(path.join(gsdDir, file), 'utf8');
      const fm = parseFrontmatter(content);
      const name = fm.name || file.replace('.md', '');
      const tagInfo = inferTags(`${name} ${fm.description || ''} ${content.substring(0, 300)}`);
      entries.push({
        name: `gsd:${name}`,
        source: 'gsd',
        description: fm.description || '',
        summary: summarize(fm.description),
        invoke: `/gsd:${name}`,
        ...tagInfo,
      });
    } catch (e) { process.stderr.write(`Warning: cannot read GSD workflow ${file}: ${e.message}\n`); }
  }
  return entries;
}

function scanHooks() {
  const entries = [];
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(CLAUDE_DIR, 'settings.json'), 'utf8'));
    const hooks = settings.hooks || {};
    for (const [event, hookList] of Object.entries(hooks)) {
      for (const hookEntry of hookList) {
        const cmds = (hookEntry.hooks || []).map(h => h.command).filter(Boolean);
        for (const cmd of cmds) {
          const name = path.basename(cmd).replace(/\.(js|sh|py)$/, '');
          entries.push({
            name,
            source: 'hook',
            description: `${event} hook: ${cmd}`,
            summary: `${event} hook that runs ${name}`,
            invoke: `hook:${event}/${name}`,
            tags: [event.toLowerCase()],
            languages: [],
            frameworks: [],
            domains: [],
          });
        }
      }
    }
  } catch (e) { /* skip */ }
  return entries;
}

function scanMCPServers() {
  const entries = [];
  // settings.local.json
  try {
    const local = JSON.parse(fs.readFileSync(path.join(CLAUDE_DIR, 'settings.local.json'), 'utf8'));
    for (const server of (local.enabledMcpjsonServers || [])) {
      entries.push({
        name: server,
        source: 'mcp',
        description: `MCP server: ${server}`,
        summary: `MCP server ${server}`,
        invoke: `mcp:${server}`,
        tags: [],
        languages: [],
        frameworks: [],
        domains: [],
      });
    }
  } catch (e) { /* skip */ }

  // Also check for .mcp.json in common project locations
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(CLAUDE_DIR, 'settings.json'), 'utf8'));
    const plugins = settings.enabledPlugins || {};
    for (const key of Object.keys(plugins)) {
      if (plugins[key]) {
        entries.push({
          name: key.split('@')[0],
          source: 'plugin',
          description: `Plugin: ${key}`,
          summary: `Enabled plugin ${key.split('@')[0]}`,
          invoke: `plugin:${key.split('@')[0]}`,
          tags: [],
          languages: [],
          frameworks: [],
          domains: [],
        });
      }
    }
  } catch (e) { /* skip */ }
  return entries;
}

function buildFingerprint() {
  const fp = {};
  const dirs = [
    path.join(CLAUDE_DIR, 'skills'),
    path.join(CLAUDE_DIR, 'agents'),
    path.join(CLAUDE_DIR, 'plugins', 'cache'),
  ];
  for (const d of dirs) {
    try {
      fp[d] = fs.readdirSync(d).length;
    } catch (e) {
      fp[d] = 0;
    }
  }
  for (const f of ['settings.json', 'settings.local.json']) {
    try {
      fp[f] = fs.statSync(path.join(CLAUDE_DIR, f)).mtimeMs;
    } catch (e) {
      fp[f] = 0;
    }
  }
  return fp;
}

function buildIndex(skills, agents, plugins, gsd, hooks, mcp) {
  const allEntries = [...skills, ...agents, ...plugins, ...gsd, ...hooks, ...mcp];

  // Deduplicate by name (prefer skill > plugin > agent > gsd)
  const seen = new Map();
  for (const entry of allEntries) {
    const key = entry.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, entry);
    }
  }
  const entries = [...seen.values()];

  // Build indexes
  const byTag = {};
  const byLang = {};
  const byFramework = {};
  const byDomain = {};

  for (const entry of entries) {
    for (const tag of (entry.tags || [])) {
      (byTag[tag] = byTag[tag] || []).push(entry.name);
    }
    for (const lang of (entry.languages || [])) {
      (byLang[lang] = byLang[lang] || []).push(entry.name);
    }
    for (const fw of (entry.frameworks || [])) {
      (byFramework[fw] = byFramework[fw] || []).push(entry.name);
    }
    for (const dom of (entry.domains || [])) {
      (byDomain[dom] = byDomain[dom] || []).push(entry.name);
    }
  }

  return {
    version: '1.0',
    generated: new Date().toISOString(),
    fingerprint: buildFingerprint(),
    totalCount: entries.length,
    skills: entries,
    byTag,
    byLang,
    byFramework,
    byDomain,
  };
}

// Exports for testing
module.exports = { inferTags, parseFrontmatter, summarize, buildIndex, NICHE_KEYWORDS, UNIVERSAL_DOMAINS };

// Main
if (require.main === module) {
  const skills = scanSkills();
  const agents = scanAgents();
  const plugins = scanPluginSkills();
  const gsd = scanGSDWorkflows();
  const hooks = scanHooks();
  const mcp = scanMCPServers();
  const index = buildIndex(skills, agents, plugins, gsd, hooks, mcp);

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`Catalog built: ${index.totalCount} entries (${skills.length} skills, ${agents.length} agents, ${plugins.length} plugin skills, ${gsd.length} GSD, ${hooks.length} hooks, ${mcp.length} MCP/plugins)`);
  console.log(`Written to: ${INDEX_PATH}`);
}
