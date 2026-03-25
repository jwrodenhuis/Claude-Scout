const { detectLanguage, getStrings, STRINGS } = require('../scripts/i18n');

describe('i18n', () => {
  const origLang = process.env.SCOUT_LANG;

  afterEach(() => {
    // Restore original SCOUT_LANG after each test
    if (origLang === undefined) {
      delete process.env.SCOUT_LANG;
    } else {
      process.env.SCOUT_LANG = origLang;
    }
  });

  describe('detectLanguage', () => {
    test('returns nl for nl_NL.UTF-8', () => {
      process.env.SCOUT_LANG = 'nl_NL.UTF-8';
      expect(detectLanguage()).toBe('nl');
    });

    test('returns nl for nl', () => {
      process.env.SCOUT_LANG = 'nl';
      expect(detectLanguage()).toBe('nl');
    });

    test('returns en for en_US.UTF-8', () => {
      process.env.SCOUT_LANG = 'en_US.UTF-8';
      expect(detectLanguage()).toBe('en');
    });

    test('returns en for unknown locale', () => {
      process.env.SCOUT_LANG = 'ja_JP.UTF-8';
      expect(detectLanguage()).toBe('en');
    });

    test('returns en for empty SCOUT_LANG', () => {
      delete process.env.SCOUT_LANG;
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      delete process.env.LC_ALL;
      expect(detectLanguage()).toBe('en');
    });
  });

  describe('getStrings — English', () => {
    beforeEach(() => { process.env.SCOUT_LANG = 'en'; });

    test('returns English skill tip label', () => {
      expect(getStrings().skillTip).toBe('Skill tip:');
    });

    test('returns English what/whyNow labels', () => {
      expect(getStrings().what).toBe('What:');
      expect(getStrings().whyNow).toBe('Why now:');
    });

    test('useText invokes skill names starting with /', () => {
      expect(getStrings().useText('/ecc:tdd')).toContain('Invoke');
    });

    test('useText launches agent names not starting with /', () => {
      expect(getStrings().useText('code-reviewer')).toContain('Launch agent');
    });

    test('returns English reason for testing', () => {
      expect(getStrings().reasonTesting('foo.test.ts')).toContain('test files');
      expect(getStrings().reasonTesting('foo.test.ts')).toContain('foo.test.ts');
    });

    test('returns English recommended skills header', () => {
      expect(getStrings().recommendedSkills).toBe('Recommended skills:');
    });

    test('returns English trigger for tdd', () => {
      expect(getStrings().triggerTdd).toContain('new features');
    });
  });

  describe('getStrings — Dutch', () => {
    beforeEach(() => { process.env.SCOUT_LANG = 'nl'; });

    test('returns Dutch what/whyNow labels', () => {
      expect(getStrings().what).toBe('Wat:');
      expect(getStrings().whyNow).toBe('Waarom nu:');
    });

    test('useText uses Dutch for skill names', () => {
      expect(getStrings().useText('/ecc:tdd')).toContain('Roep aan');
    });

    test('useText uses Dutch for agents', () => {
      expect(getStrings().useText('code-reviewer')).toContain('Lanceer agent');
    });

    test('returns Dutch reason for testing', () => {
      expect(getStrings().reasonTesting('foo.test.ts')).toContain('test bestanden');
    });

    test('returns Dutch recommended skills header', () => {
      expect(getStrings().recommendedSkills).toBe('Aanbevolen skills:');
    });

    test('returns Dutch trigger for tdd', () => {
      expect(getStrings().triggerTdd).toContain('nieuwe features');
    });

    test('returns Dutch section header', () => {
      expect(getStrings().sectionHeader).toBe('Scout Aanbevelingen');
    });
  });

  describe('STRINGS completeness', () => {
    test('nl and en have identical keys', () => {
      const enKeys = Object.keys(STRINGS.en).sort();
      const nlKeys = Object.keys(STRINGS.nl).sort();
      expect(nlKeys).toEqual(enKeys);
    });
  });
});
