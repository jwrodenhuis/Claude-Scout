#!/usr/bin/env node
/**
 * Online search for MCP servers, skills, and agents from public registries.
 * Sources: npm registry, Glama MCP registry.
 * Results are cached per project fingerprint with configurable TTL.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CACHE_PATH = path.join(CLAUDE_DIR, 'skills', '.online-cache.json');

const TTL_SESSION = 7 * 24 * 60 * 60 * 1000;   // 7 days
const TTL_BOOTSTRAP = 0;                          // always fresh
const REQUEST_TIMEOUT = 6000;                     // 6s per source
const MAX_RESULTS_PER_SOURCE = 30;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { 'Accept': 'application/json', 'User-Agent': 'claude-scout/1.0', ...headers },
    };
    const req = https.get(url, opts, res => {
      if (res.statusCode === 429) { reject(new Error('rate-limited')); return; }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('invalid JSON')); }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// ─── Cache ────────────────────────────────────────────────────────────────────

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch (e) { return {}; }
}

function saveCache(cache) {
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); }
  catch (e) { /* can't write cache, skip */ }
}

function projectFingerprint(project) {
  const lang = (project.primary || project.language || 'unknown').toLowerCase();
  const fw = (project.frameworks || []).slice(0, 2).sort().join('+');
  return fw ? `${lang}:${fw}` : lang;
}

// ─── npm registry ─────────────────────────────────────────────────────────────

const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search';

// Project-aware search queries for npm
function buildNpmQueries(project) {
  const queries = new Set();
  const langs = (project.languages || [project.language]).filter(Boolean).map(l => l.toLowerCase());
  const fws = (project.frameworks || []).map(f => f.toLowerCase());

  // Always include generic MCP server searches
  queries.add('keywords:mcp-server');
  queries.add('keywords:mcp claude');

  // Language-specific
  for (const lang of langs) {
    if (['typescript', 'javascript'].includes(lang)) {
      queries.add('mcp-server typescript');
    } else if (lang === 'python') {
      queries.add('mcp-server python');
    } else if (lang === 'go') {
      queries.add('mcp-server golang');
    }
  }

  // Framework-specific
  for (const fw of fws) {
    if (['next', 'nextjs', 'react'].includes(fw)) queries.add('mcp nextjs');
    if (['django', 'fastapi', 'flask'].includes(fw)) queries.add('mcp python web');
    if (['prisma', 'drizzle-orm'].includes(fw)) queries.add('mcp database orm');
    if (['postgres', 'postgresql', 'mysql', 'sqlite'].includes(fw)) queries.add('mcp database sql');
  }

  // Dependency-based
  const deps = (project.dependencies || []).map(d => d.toLowerCase());
  if (deps.some(d => ['drizzle-orm', 'prisma'].includes(d))) queries.add('mcp database');
  if (deps.some(d => ['stripe', '@stripe/stripe-js'].includes(d))) queries.add('mcp stripe');
  if (deps.some(d => d.includes('github'))) queries.add('mcp github');
  if (deps.some(d => ['@supabase/supabase-js', 'supabase'].includes(d))) queries.add('mcp supabase');

  return [...queries].slice(0, 5); // max 5 queries to avoid hammering npm
}

async function searchNpm(project) {
  const queries = buildNpmQueries(project);
  const seen = new Set();
  const results = [];

  for (const q of queries) {
    try {
      const url = `${NPM_SEARCH}?text=${encodeURIComponent(q)}&size=${MAX_RESULTS_PER_SOURCE}`;
      const data = await httpsGet(url);
      for (const obj of (data.objects || [])) {
        const pkg = obj.package;
        if (seen.has(pkg.name)) continue;
        seen.add(pkg.name);
        // Only include packages that look like MCP servers or Claude tools
        const keywords = (pkg.keywords || []).map(k => k.toLowerCase());
        const isMcp = keywords.includes('mcp') || keywords.includes('mcp-server') ||
          pkg.name.includes('mcp') || (pkg.description || '').toLowerCase().includes('model context protocol');
        if (!isMcp) continue;
        results.push({
          name: pkg.name,
          description: pkg.description || '',
          source: 'npm',
          install: `npx ${pkg.name}`,
          url: `https://www.npmjs.com/package/${pkg.name}`,
          keywords,
          npmScore: obj.score?.final || 0,
        });
      }
    } catch (e) {
      // Source failed, continue with others
      process.stderr.write(`Scout online-search: npm query "${q}" failed: ${e.message}\n`);
    }
  }

  return results;
}

// ─── Glama MCP registry ───────────────────────────────────────────────────────

const GLAMA_API = 'https://glama.ai/api/mcp/v1/servers';

async function searchGlama(project) {
  const langs = (project.languages || [project.language]).filter(Boolean).map(l => l.toLowerCase());
  const results = [];
  const seen = new Set();

  // Fetch up to 2 pages from Glama (no reliable keyword filter, we score locally)
  let cursor = null;
  let pages = 0;
  const maxPages = 2;

  while (pages < maxPages) {
    try {
      const url = cursor
        ? `${GLAMA_API}?first=${MAX_RESULTS_PER_SOURCE}&after=${encodeURIComponent(cursor)}`
        : `${GLAMA_API}?first=${MAX_RESULTS_PER_SOURCE}`;
      const data = await httpsGet(url);
      const servers = data.servers || [];

      for (const s of servers) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        results.push({
          name: s.name,
          description: s.description || '',
          source: 'glama',
          install: s.repository?.url ? `# See: ${s.repository.url}` : null,
          url: s.url || `https://glama.ai/mcp/servers/${s.id}`,
          attributes: s.attributes || [],
          slug: s.slug,
        });
      }

      cursor = data.pageInfo?.endCursor;
      if (!cursor || !data.pageInfo?.hasNextPage) break;
      pages++;
    } catch (e) {
      process.stderr.write(`Scout online-search: Glama fetch failed: ${e.message}\n`);
      break;
    }
  }

  return results;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score an online result against the project profile.
 * Higher = more relevant. Returns 0 if not relevant.
 */
function scoreOnlineResult(item, project) {
  const langs = (project.languages || [project.language]).filter(Boolean).map(l => l.toLowerCase());
  const fws = (project.frameworks || []).map(f => f.toLowerCase());
  const deps = (project.dependencies || []).map(d => d.toLowerCase());
  const text = `${item.name} ${item.description}`.toLowerCase();
  const keywords = (item.keywords || []).map(k => k.toLowerCase());

  let score = 0;

  // Language relevance
  for (const lang of langs) {
    if (text.includes(lang) || keywords.includes(lang)) score += 10;
  }

  // Framework relevance
  for (const fw of fws) {
    if (text.includes(fw) || keywords.includes(fw)) score += 15;
  }

  // Dependency relevance
  for (const dep of deps) {
    if (dep.length >= 4 && text.includes(dep.replace(/[-\/].*/, ''))) { score += 12; break; }
  }

  // Domain relevance
  if (project.database && (text.includes('database') || text.includes('sql') || text.includes('postgres') || text.includes('mysql'))) score += 8;
  if (project.hasDocker && (text.includes('docker') || text.includes('container'))) score += 8;
  if (project.hasCICD && (text.includes('ci') || text.includes('github actions'))) score += 5;

  // Generic boost for well-known useful tools
  const alwaysUseful = ['github', 'filesystem', 'memory', 'search', 'browser', 'fetch', 'puppeteer', 'playwright'];
  for (const u of alwaysUseful) {
    if (text.includes(u)) { score += 5; break; }
  }

  // npm quality boost
  if (item.npmScore) score += Math.round(item.npmScore * 5);

  // Require minimum relevance
  return score >= 8 ? score : 0;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Search online sources for tools relevant to the given project.
 * @param {object} project - Detected project profile
 * @param {object} options
 * @param {boolean} options.forceRefresh - Bypass cache (default: false)
 * @param {number}  options.ttl          - Cache TTL in ms (default: TTL_SESSION)
 * @returns {Promise<Array>} Ranked list of online tool recommendations
 */
async function getOnlineRecommendations(project, options = {}) {
  const { forceRefresh = false, ttl = TTL_SESSION } = options;
  const fp = projectFingerprint(project);
  const cache = loadCache();

  // Check cache
  if (!forceRefresh && ttl > 0) {
    const entry = cache[fp];
    if (entry && Date.now() - entry.fetchedAt < ttl) {
      return entry.results;
    }
  }

  // Fetch from all sources in parallel
  const [npmResults, glamaResults] = await Promise.all([
    searchNpm(project).catch(() => []),
    searchGlama(project).catch(() => []),
  ]);

  const all = [...npmResults, ...glamaResults];

  // Deduplicate by name (case-insensitive)
  const seen = new Set();
  const deduped = all.filter(item => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score and rank
  const scored = deduped
    .map(item => ({ ...item, relevanceScore: scoreOnlineResult(item, project) }))
    .filter(item => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 15);

  // Save to cache
  cache[fp] = { fetchedAt: Date.now(), results: scored };
  saveCache(cache);

  return scored;
}

/**
 * Check if the cache for this project is stale (older than given age in ms).
 */
function isCacheStale(project, maxAge = TTL_SESSION) {
  const fp = projectFingerprint(project);
  const cache = loadCache();
  const entry = cache[fp];
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > maxAge;
}

/**
 * Format online results for display in the briefing.
 */
function formatOnlineSection(results, strings) {
  if (!results || results.length === 0) return null;
  const str = strings || { onlineTools: 'Available online (not installed):', install: 'Install:' };
  const lines = [str.onlineTools || 'Available online (not installed):'];
  results.slice(0, 8).forEach((r, i) => {
    lines.push(` ${i + 1}. ${r.name} — ${r.description.slice(0, 80)}${r.description.length > 80 ? '…' : ''}`);
    if (r.install && !r.install.startsWith('#')) {
      lines.push(`    ${str.install || 'Install:'} ${r.install}`);
    } else if (r.url) {
      lines.push(`    ${r.url}`);
    }
  });
  return lines.join('\n');
}

/**
 * Return cached results for the given project without triggering a fetch.
 */
function getCachedResults(project) {
  const fp = projectFingerprint(project);
  const cache = loadCache();
  return cache[fp]?.results || [];
}

module.exports = { getOnlineRecommendations, getCachedResults, isCacheStale, formatOnlineSection, scoreOnlineResult, projectFingerprint, TTL_SESSION, TTL_BOOTSTRAP };

// CLI: node online-search.js [--refresh] [--project-dir <dir>]
if (require.main === module) {
  const args = process.argv.slice(2);
  const forceRefresh = args.includes('--refresh');
  const dirIdx = args.indexOf('--project-dir');
  const projectDir = dirIdx !== -1 ? args[dirIdx + 1] : process.cwd();

  let project = { languages: ['typescript', 'javascript'], frameworks: [], dependencies: [] };
  try {
    const { detect } = require(path.join(__dirname, 'project-detector'));
    project = detect(projectDir);
  } catch (e) { /* use default */ }

  getOnlineRecommendations(project, { forceRefresh })
    .then(results => {
      console.log(`Found ${results.length} online tools for ${projectFingerprint(project)}:\n`);
      results.forEach((r, i) => {
        console.log(`${i + 1}. [${r.source}] ${r.name} (score: ${r.relevanceScore})`);
        console.log(`   ${r.description.slice(0, 100)}`);
        if (r.install && !r.install.startsWith('#')) console.log(`   Install: ${r.install}`);
        console.log(`   ${r.url}`);
        console.log();
      });
    })
    .catch(e => {
      process.stderr.write(`Error: ${e.message}\n`);
      process.exit(1);
    });
}
