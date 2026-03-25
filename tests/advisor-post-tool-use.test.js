const { analyzeAction, formatSuggestion, getReasonText, ACTION_PATTERNS } = require('../hooks/advisor-post-tool-use');

describe('advisor-post-tool-use', () => {
  describe('analyzeAction — pattern matching', () => {
    test('detects testing pattern from .test.ts file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/utils/auth.test.ts' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('testing');
    });

    test('detects testing pattern from .spec.js file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/__tests__/foo.spec.js' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('testing');
    });

    test('detects API pattern from routes directory', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/api/users/route.ts' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('api');
    });

    test('detects database pattern from .sql file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/db/migrations/001.sql' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('database');
    });

    test('detects security pattern from auth file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/middleware/auth.ts' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('security');
    });

    test('detects frontend pattern from .tsx component', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/components/Header.tsx' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('frontend');
    });

    test('detects docker pattern from Dockerfile', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/Dockerfile' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('docker');
    });

    test('detects build error from Bash output', () => {
      const match = analyzeAction({
        tool_name: 'Bash',
        tool_input: { command: 'npm run build' },
        tool_output: 'error TS2345: Argument of type string is not assignable',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('build-error');
    });

    test('detects data science from notebook file', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/notebooks/analysis.ipynb' },
        tool_output: '',
      });
      expect(match).not.toBeNull();
      expect(match.id).toBe('data-science');
    });

    test('returns null for unrecognized action', () => {
      const match = analyzeAction({
        tool_name: 'Edit',
        tool_input: { file_path: '/README.md' },
        tool_output: '',
      });
      expect(match).toBeNull();
    });
  });

  describe('formatSuggestion', () => {
    test('includes What, Waarom nu, Gebruik sections', () => {
      const match = ACTION_PATTERNS.find(p => p.id === 'testing');
      const result = formatSuggestion(match, '/src/utils/foo.test.ts');
      expect(result).toContain('Skill tip:');
      expect(result).toContain('Wat:');
      expect(result).toContain('Waarom nu:');
      expect(result).toContain('Gebruik:');
    });

    test('mentions alternative tools when available', () => {
      const match = ACTION_PATTERNS.find(p => p.id === 'testing');
      const result = formatSuggestion(match, '/test.ts');
      expect(result).toContain('ook beschikbaar:');
    });
  });

  describe('getReasonText', () => {
    test('includes filename when provided', () => {
      const reason = getReasonText('testing', '/src/foo.test.ts');
      expect(reason).toContain('foo.test.ts');
    });

    test('works without filename', () => {
      const reason = getReasonText('testing', '');
      expect(reason).toContain('test bestanden');
    });

    test('returns default for unknown pattern', () => {
      const reason = getReasonText('unknown', '/file.txt');
      expect(reason).toContain('Relevante patronen');
    });
  });
});
