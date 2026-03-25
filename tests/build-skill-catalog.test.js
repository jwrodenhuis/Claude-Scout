const { inferTags, parseFrontmatter, summarize } = require('../scripts/build-skill-catalog');

describe('build-skill-catalog', () => {
  describe('inferTags', () => {
    test('detects Python from keyword', () => {
      const result = inferTags('Comprehensive Python toolkit for data analysis');
      expect(result.languages).toContain('python');
    });

    test('detects TypeScript from keyword', () => {
      const result = inferTags('TypeScript strict mode patterns for tsconfig');
      expect(result.languages).toContain('typescript');
    });

    test('detects multiple languages', () => {
      const result = inferTags('Python and JavaScript interoperability with Node.js');
      expect(result.languages).toContain('python');
      expect(result.languages).toContain('javascript');
    });

    test('detects testing domain', () => {
      const result = inferTags('TDD workflow with jest and coverage');
      expect(result.domains).toContain('testing');
    });

    test('detects security domain', () => {
      const result = inferTags('OWASP security vulnerabilities and injection prevention');
      expect(result.domains).toContain('security');
    });

    test('detects database domain', () => {
      const result = inferTags('PostgreSQL query optimization and schema design');
      expect(result.domains).toContain('database');
    });

    test('detects React framework', () => {
      const result = inferTags('React hooks useState useEffect patterns');
      expect(result.frameworks).toContain('react');
    });

    test('detects Django framework', () => {
      const result = inferTags('Django REST framework API patterns');
      expect(result.frameworks).toContain('django');
    });

    test('detects Spring framework', () => {
      const result = inferTags('Spring Boot microservice patterns');
      expect(result.frameworks).toContain('spring');
    });

    test('returns empty for unrelated text', () => {
      const result = inferTags('Cooking recipes for pasta lovers');
      expect(result.languages).toEqual([]);
      expect(result.frameworks).toEqual([]);
      expect(result.domains).toEqual([]);
    });

    test('handles empty input', () => {
      const result = inferTags('');
      expect(result.languages).toEqual([]);
    });

    test('handles null input', () => {
      const result = inferTags(null);
      expect(result.languages).toEqual([]);
    });
  });

  describe('parseFrontmatter', () => {
    test('parses valid frontmatter', () => {
      const content = '---\nname: test-skill\ndescription: "A test skill"\n---\n# Content';
      const result = parseFrontmatter(content);
      expect(result.name).toBe('test-skill');
      expect(result.description).toBe('A test skill');
    });

    test('returns empty object for no frontmatter', () => {
      const result = parseFrontmatter('# Just a heading\nSome content');
      expect(result).toEqual({});
    });

    test('returns empty object for empty string', () => {
      const result = parseFrontmatter('');
      expect(result).toEqual({});
    });

    test('handles frontmatter without quotes', () => {
      const content = '---\nname: my-skill\n---';
      const result = parseFrontmatter(content);
      expect(result.name).toBe('my-skill');
    });
  });

  describe('summarize', () => {
    test('returns short description unchanged', () => {
      expect(summarize('Short description')).toBe('Short description');
    });

    test('truncates long description with ellipsis', () => {
      const long = 'A'.repeat(200);
      const result = summarize(long, 120);
      expect(result.length).toBe(120);
      expect(result).toMatch(/\.\.\.$/);
    });

    test('returns empty string for null input', () => {
      expect(summarize(null)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(summarize(undefined)).toBe('');
    });

    test('collapses whitespace', () => {
      expect(summarize('multiple   spaces\n\nnewlines')).toBe('multiple spaces newlines');
    });
  });
});
