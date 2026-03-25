const path = require('path');
const { detect } = require('../scripts/project-detector');

const fixture = (name) => path.join(__dirname, 'fixtures', name);

describe('project-detector', () => {
  describe('language detection', () => {
    test('detects JavaScript from package.json without typescript', () => {
      const result = detect(fixture('js-project'));
      expect(result.language).toBe('javascript');
      expect(result.languages).toContain('javascript');
      expect(result.languages).not.toContain('typescript');
    });

    test('detects TypeScript from tsconfig.json + typescript dep', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.language).toBe('typescript');
      expect(result.languages).toContain('typescript');
      expect(result.languages).toContain('javascript');
    });

    test('detects Python from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.language).toBe('python');
      expect(result.languages).toContain('python');
    });

    test('detects Go from go.mod', () => {
      const result = detect(fixture('go-project'));
      expect(result.language).toBe('go');
      expect(result.languages).toContain('go');
    });

    test('detects Rust from Cargo.toml', () => {
      const result = detect(fixture('rust-project'));
      expect(result.language).toBe('rust');
      expect(result.languages).toContain('rust');
    });

    test('detects Ruby from Gemfile', () => {
      const result = detect(fixture('ruby-rails'));
      expect(result.language).toBe('ruby');
      expect(result.languages).toContain('ruby');
    });

    test('detects Java from pom.xml', () => {
      const result = detect(fixture('java-spring'));
      expect(result.language).toBe('java');
      expect(result.languages).toContain('java');
    });

    test('detects Swift from Package.swift', () => {
      const result = detect(fixture('swift-project'));
      expect(result.language).toBe('swift');
      expect(result.languages).toContain('swift');
    });

    test('returns null language for empty project', () => {
      const result = detect(fixture('empty-project'));
      expect(result.language).toBeNull();
      expect(result.languages).toEqual([]);
    });
  });

  describe('framework detection', () => {
    test('detects Next.js + React from next dependency', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.framework).toBe('next');
      expect(result.frameworks).toContain('next');
      expect(result.frameworks).toContain('react');
    });

    test('detects Express from express dependency', () => {
      const result = detect(fixture('js-project'));
      expect(result.framework).toBe('express');
      expect(result.frameworks).toContain('express');
    });

    test('detects Django from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.frameworks).toContain('django');
    });

    test('detects Rails from Gemfile', () => {
      const result = detect(fixture('ruby-rails'));
      expect(result.frameworks).toContain('rails');
    });

    test('detects Spring from pom.xml', () => {
      const result = detect(fixture('java-spring'));
      expect(result.frameworks).toContain('spring');
    });

    test('detects Actix + Tokio from Cargo.toml', () => {
      const result = detect(fixture('rust-project'));
      expect(result.frameworks).toContain('actix');
      expect(result.frameworks).toContain('tokio');
    });
  });

  describe('database + test runner detection', () => {
    test('detects Drizzle ORM → PostgreSQL', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.database).toBe('postgresql');
      expect(result.frameworks).toContain('drizzle');
    });

    test('detects vitest test runner', () => {
      const result = detect(fixture('ts-next-project'));
      expect(result.testRunner).toBe('vitest');
    });

    test('detects jest test runner', () => {
      const result = detect(fixture('js-project'));
      expect(result.testRunner).toBe('jest');
    });

    test('detects pytest from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.testRunner).toBe('pytest');
    });

    test('detects rspec from Gemfile', () => {
      const result = detect(fixture('ruby-rails'));
      expect(result.testRunner).toBe('rspec');
    });

    test('detects SQLAlchemy framework from pyproject.toml', () => {
      const result = detect(fixture('python-django'));
      expect(result.frameworks).toContain('sqlalchemy');
    });
  });

  describe('Docker + CI/CD detection', () => {
    test('detects Docker from Dockerfile', () => {
      const result = detect(fixture('docker-project'));
      expect(result.hasDocker).toBe(true);
    });

    test('detects CI/CD from .github/workflows', () => {
      const result = detect(fixture('cicd-project'));
      expect(result.hasCICD).toBe(true);
    });

    test('no Docker for empty project', () => {
      const result = detect(fixture('empty-project'));
      expect(result.hasDocker).toBe(false);
    });

    test('no CI/CD for empty project', () => {
      const result = detect(fixture('empty-project'));
      expect(result.hasCICD).toBe(false);
    });
  });

  describe('project name', () => {
    test('uses directory basename as project name', () => {
      const result = detect(fixture('js-project'));
      expect(result.projectName).toBe('js-project');
    });
  });

  describe('expanded framework detection', () => {
    test('detects Go + Gin framework from go.mod require block', () => {
      const result = detect(fixture('go-gin-project'));
      expect(result.language).toBe('go');
      expect(result.frameworks).toContain('gin');
    });

    test('detects Angular from angular.json', () => {
      const result = detect(fixture('angular-project'));
      expect(result.frameworks).toContain('angular');
    });

    test('detects Angular from @angular/core dependency', () => {
      const result = detect(fixture('angular-project'));
      expect(result.language).toBe('typescript');
    });

    test('detects SvelteKit from @sveltejs/kit dependency', () => {
      const result = detect(fixture('sveltekit-project'));
      expect(result.framework).toBe('sveltekit');
      expect(result.frameworks).toContain('sveltekit');
      expect(result.frameworks).toContain('svelte');
    });

    test('detects monorepo from workspaces field', () => {
      const result = detect(fixture('monorepo-project'));
      expect(result.monorepo).toBe(true);
    });

    test('detects FastAPI from pyproject.toml poetry deps', () => {
      const result = detect(fixture('python-fastapi'));
      expect(result.language).toBe('python');
      expect(result.frameworks).toContain('fastapi');
    });

    test('non-monorepo projects have monorepo false', () => {
      const result = detect(fixture('js-project'));
      expect(result.monorepo).toBe(false);
    });
  });
});
