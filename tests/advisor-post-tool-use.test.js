// Force English strings in tests regardless of system locale
process.env.SCOUT_LANG = 'en';

const { analyzeAction, formatSuggestion, getReasonText, ACTION_PATTERNS } = require('../hooks/advisor-post-tool-use');
const { formatMultiSuggestion } = require('../hooks/advisor-post-tool-use');

describe('advisor-post-tool-use', () => {
  describe('analyzeAction — pattern matching', () => {
    test('detects testing pattern from .test.ts file', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/utils/auth.test.ts' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('testing');
    });

    test('detects testing pattern from .spec.js file', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/__tests__/foo.spec.js' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('testing');
    });

    test('detects API pattern from routes directory', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/api/users/route.ts' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('api');
    });

    test('detects database pattern from .sql file', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/db/migrations/001.sql' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('database');
    });

    test('detects security pattern from auth file', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/middleware/auth.ts' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('security');
    });

    test('detects frontend pattern from .tsx component', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/components/Header.tsx' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('frontend');
    });

    test('detects docker pattern from Dockerfile', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/Dockerfile' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('docker');
    });

    test('detects build error from Bash output', () => {
      const matches = analyzeAction({
        tool_name: 'Bash',
        tool_input: { command: 'npm run build' },
        tool_output: 'error TS2345: Argument of type string is not assignable',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('build-error');
    });

    test('detects data science from notebook file', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/notebooks/analysis.ipynb' },
        tool_output: '',
      });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].id).toBe('data-science');
    });

    test('returns empty array for unrecognized action', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/README.md' },
        tool_output: '',
      });
      expect(matches).toEqual([]);
    });
  });

  describe('analyzeAction — multi-pattern', () => {
    test('returns array of matches', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/api/auth/route.ts' },
        tool_output: '',
      });
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    test('returns empty array for unrecognized action', () => {
      const matches = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/README.md' },
        tool_output: '',
      });
      expect(matches).toEqual([]);
    });
  });

  describe('formatSuggestion', () => {
    test('includes What, Why now, Use sections', () => {
      const match = ACTION_PATTERNS.find(p => p.id === 'testing');
      const result = formatSuggestion(match, '/src/utils/foo.test.ts');
      expect(result).toContain('Skill tip:');
      expect(result).toContain('What:');
      expect(result).toContain('Why now:');
      expect(result).toContain('Use:');
    });

    test('mentions alternative tools when available', () => {
      const match = ACTION_PATTERNS.find(p => p.id === 'testing');
      const result = formatSuggestion(match, '/test.ts');
      expect(result).toContain('also available:');
    });
  });

  describe('formatMultiSuggestion', () => {
    test('formats single match same as formatSuggestion', () => {
      const match = ACTION_PATTERNS.find(p => p.id === 'testing');
      const result = formatMultiSuggestion([{ ...match, confidence: 5 }], '/test.ts');
      expect(result).toContain('Skill tip:');
    });

    test('formats multiple matches with combined advice', () => {
      const api = { ...ACTION_PATTERNS.find(p => p.id === 'api'), confidence: 5 };
      const security = { ...ACTION_PATTERNS.find(p => p.id === 'security'), confidence: 4 };
      const result = formatMultiSuggestion([api, security], '/src/api/auth.ts');
      expect(result).toContain('Skill tips:');
      expect(result).toContain('Combined advice:');
    });

    test('returns null for empty matches', () => {
      expect(formatMultiSuggestion([], '/test.ts')).toBeNull();
    });
  });

  describe('getReasonText', () => {
    test('includes filename when provided', () => {
      const reason = getReasonText('testing', '/src/foo.test.ts');
      expect(reason).toContain('foo.test.ts');
    });

    test('works without filename', () => {
      const reason = getReasonText('testing', '');
      expect(reason).toContain('test files');
    });

    test('returns default for unknown pattern', () => {
      const reason = getReasonText('unknown', '/file.txt');
      expect(reason).toContain('Relevant patterns');
    });
  });
});
