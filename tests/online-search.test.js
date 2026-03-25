// Force English strings in tests regardless of system locale
process.env.SCOUT_LANG = 'en';

const path = require('path');
const os = require('os');
const fs = require('fs');

// We test only the pure functions (no real HTTP calls in unit tests)
const {
  scoreOnlineResult,
  projectFingerprint,
  formatOnlineSection,
  getCachedResults,
  isCacheStale,
  TTL_SESSION,
} = require('../scripts/online-search');

describe('online-search', () => {
  describe('projectFingerprint', () => {
    test('returns primary language when no frameworks', () => {
      const fp = projectFingerprint({ primary: 'typescript', frameworks: [] });
      expect(fp).toBe('typescript');
    });

    test('includes sorted frameworks', () => {
      const fp = projectFingerprint({ primary: 'typescript', frameworks: ['react', 'next'] });
      expect(fp).toContain('typescript');
      expect(fp).toContain('next');
      expect(fp).toContain('react');
    });

    test('falls back to language field', () => {
      const fp = projectFingerprint({ language: 'python', frameworks: [] });
      expect(fp).toBe('python');
    });

    test('falls back to unknown when no language info', () => {
      const fp = projectFingerprint({});
      expect(fp).toBe('unknown');
    });
  });

  describe('scoreOnlineResult', () => {
    const project = {
      languages: ['typescript', 'javascript'],
      frameworks: ['next', 'react'],
      dependencies: ['drizzle-orm', 'next', 'react'],
      database: 'postgresql',
      hasDocker: false,
      hasCICD: true,
    };

    test('scores language match', () => {
      const item = { name: 'typescript-mcp-helper', description: 'TypeScript MCP server', keywords: ['typescript', 'mcp'] };
      expect(scoreOnlineResult(item, project)).toBeGreaterThanOrEqual(10);
    });

    test('scores framework match', () => {
      const item = { name: 'nextjs-mcp', description: 'MCP server for Next.js apps', keywords: ['nextjs', 'mcp'] };
      expect(scoreOnlineResult(item, project)).toBeGreaterThanOrEqual(15);
    });

    test('scores dependency match', () => {
      const item = { name: 'drizzle-mcp', description: 'Drizzle ORM MCP server', keywords: ['mcp'] };
      expect(scoreOnlineResult(item, project)).toBeGreaterThan(0);
    });

    test('scores database domain when project has database', () => {
      const item = { name: 'pg-mcp', description: 'PostgreSQL database MCP server', keywords: ['mcp', 'postgres'] };
      expect(scoreOnlineResult(item, project)).toBeGreaterThan(0);
    });

    test('scores generic useful tools when combined with language match', () => {
      // github boost (+5) + typescript language match (+10) = 15, above threshold
      const item = { name: 'mcp-github', description: 'GitHub MCP server for TypeScript projects', keywords: ['github', 'mcp', 'typescript'] };
      expect(scoreOnlineResult(item, project)).toBeGreaterThan(0);
    });

    test('returns 0 for unrelated tool', () => {
      const item = { name: 'cobol-mcp', description: 'COBOL legacy MCP server', keywords: ['cobol'] };
      // cobol is not in our project, so score should be < 8 → returns 0
      expect(scoreOnlineResult(item, project)).toBe(0);
    });

    test('boosts score with npm quality score', () => {
      const base = { name: 'mcp-browser', description: 'Browser MCP server', keywords: ['mcp', 'browser'] };
      const withScore = { ...base, npmScore: 0.9 };
      expect(scoreOnlineResult(withScore, project)).toBeGreaterThan(scoreOnlineResult(base, project));
    });
  });

  describe('formatOnlineSection', () => {
    const results = [
      { name: '@modelcontextprotocol/server-github', description: 'GitHub MCP server', install: 'npx @modelcontextprotocol/server-github', url: 'https://npmjs.com/...' },
      { name: 'mcp-server-postgres', description: 'PostgreSQL MCP server for querying databases', install: 'npx mcp-server-postgres', url: 'https://npmjs.com/...' },
    ];

    test('includes onlineTools header', () => {
      const section = formatOnlineSection(results, { onlineTools: 'Available online (not yet installed):', install: 'Install:' });
      expect(section).toContain('Available online');
    });

    test('includes tool names', () => {
      const section = formatOnlineSection(results, { onlineTools: 'Available online:', install: 'Install:' });
      expect(section).toContain('server-github');
      expect(section).toContain('mcp-server-postgres');
    });

    test('includes install commands', () => {
      const section = formatOnlineSection(results, { onlineTools: 'Available online:', install: 'Install:' });
      expect(section).toContain('npx @modelcontextprotocol/server-github');
    });

    test('shows URL when no install command', () => {
      const noInstall = [{ name: 'custom-mcp', description: 'Custom server', install: null, url: 'https://example.com/custom-mcp' }];
      const section = formatOnlineSection(noInstall, { onlineTools: 'Available online:', install: 'Install:' });
      expect(section).toContain('https://example.com/custom-mcp');
    });

    test('returns null for empty results', () => {
      expect(formatOnlineSection([], { onlineTools: 'Available online:', install: 'Install:' })).toBeNull();
    });

    test('returns null for null results', () => {
      expect(formatOnlineSection(null, { onlineTools: 'Available online:', install: 'Install:' })).toBeNull();
    });

    test('truncates long descriptions', () => {
      const long = [{ name: 'mcp-tool', description: 'A'.repeat(200), install: 'npx mcp-tool', url: 'https://example.com' }];
      const section = formatOnlineSection(long, { onlineTools: 'Available online:', install: 'Install:' });
      expect(section).toContain('…');
    });

    test('limits output to 8 results', () => {
      const many = Array.from({ length: 15 }, (_, i) => ({
        name: `mcp-tool-${i}`,
        description: 'An MCP tool',
        install: `npx mcp-tool-${i}`,
        url: `https://example.com/${i}`,
      }));
      const section = formatOnlineSection(many, { onlineTools: 'Available online:', install: 'Install:' });
      expect((section.match(/npx mcp-tool-/g) || []).length).toBe(8);
    });
  });

  describe('cache functions', () => {
    let tmpCacheDir;
    const origCachePath = path.join(os.homedir(), '.claude', 'skills', '.online-cache.json');
    let origContent;

    beforeEach(() => {
      // Back up existing cache if present
      try { origContent = fs.readFileSync(origCachePath, 'utf8'); } catch (e) { origContent = null; }
    });

    afterEach(() => {
      // Restore cache
      if (origContent !== null) {
        try { fs.writeFileSync(origCachePath, origContent); } catch (e) { /* ignore */ }
      } else {
        try { fs.unlinkSync(origCachePath); } catch (e) { /* ignore */ }
      }
    });

    test('getCachedResults returns empty array for unknown project', () => {
      const project = { primary: 'cobol-99999', frameworks: [] };
      const results = getCachedResults(project);
      expect(Array.isArray(results)).toBe(true);
    });

    test('isCacheStale returns true for unknown project', () => {
      const project = { primary: 'cobol-99999', frameworks: [] };
      expect(isCacheStale(project, TTL_SESSION)).toBe(true);
    });
  });
});
