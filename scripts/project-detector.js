#!/usr/bin/env node
/**
 * Project Detector
 * Detects project type, language, framework, and dependencies from cwd.
 * Shared module used by Session Scout and Action Advisor.
 */

const fs = require('fs');
const path = require('path');

function detect(cwd) {
  const result = {
    language: null,
    languages: [],
    framework: null,
    frameworks: [],
    testRunner: null,
    database: null,
    dependencies: [],
    hasDocker: false,
    hasCICD: false,
    projectName: path.basename(cwd),
  };

  // package.json — JS/TS ecosystem
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depNames = Object.keys(allDeps);
      result.dependencies = depNames.slice(0, 30); // cap for sanity

      // Language
      if (depNames.includes('typescript') || fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
        result.language = 'typescript';
        result.languages.push('typescript', 'javascript');
      } else {
        result.language = 'javascript';
        result.languages.push('javascript');
      }

      // Frameworks
      if (depNames.includes('next')) { result.framework = 'next'; result.frameworks.push('next', 'react'); }
      else if (depNames.includes('react')) { result.framework = 'react'; result.frameworks.push('react'); }
      else if (depNames.includes('vue')) { result.framework = 'vue'; result.frameworks.push('vue'); }
      else if (depNames.includes('svelte')) { result.framework = 'svelte'; result.frameworks.push('svelte'); }
      else if (depNames.includes('express')) { result.framework = 'express'; result.frameworks.push('express'); }
      else if (depNames.includes('fastify')) { result.framework = 'fastify'; result.frameworks.push('fastify'); }
      else if (depNames.includes('hono')) { result.framework = 'hono'; result.frameworks.push('hono'); }

      // Test runner
      if (depNames.includes('vitest')) result.testRunner = 'vitest';
      else if (depNames.includes('jest')) result.testRunner = 'jest';
      else if (depNames.includes('mocha')) result.testRunner = 'mocha';
      else if (depNames.includes('playwright')) result.testRunner = 'playwright';

      // Database
      if (depNames.includes('drizzle-orm')) { result.database = 'postgresql'; result.frameworks.push('drizzle'); }
      else if (depNames.includes('prisma') || depNames.includes('@prisma/client')) { result.database = 'postgresql'; result.frameworks.push('prisma'); }
      else if (depNames.includes('mongoose')) result.database = 'mongodb';
      else if (depNames.includes('pg') || depNames.includes('postgres')) result.database = 'postgresql';
      else if (depNames.includes('mysql2')) result.database = 'mysql';
      else if (depNames.includes('redis') || depNames.includes('ioredis')) result.database = 'redis';

      // Auth
      if (depNames.includes('next-auth') || depNames.includes('@auth/core')) result.frameworks.push('auth');
    } catch (e) { /* skip */ }
  }

  // pyproject.toml — Python
  const pyprojectPath = path.join(cwd, 'pyproject.toml');
  const setupPath = path.join(cwd, 'setup.py');
  const reqPath = path.join(cwd, 'requirements.txt');
  if (fs.existsSync(pyprojectPath) || fs.existsSync(setupPath) || fs.existsSync(reqPath)) {
    result.language = result.language || 'python';
    result.languages.push('python');
    try {
      const content = fs.existsSync(pyprojectPath)
        ? fs.readFileSync(pyprojectPath, 'utf8')
        : fs.existsSync(reqPath)
          ? fs.readFileSync(reqPath, 'utf8')
          : '';
      const lower = content.toLowerCase();
      if (lower.includes('fastapi')) { result.framework = result.framework || 'fastapi'; result.frameworks.push('fastapi'); }
      if (lower.includes('django')) { result.framework = result.framework || 'django'; result.frameworks.push('django'); }
      if (lower.includes('flask')) { result.framework = result.framework || 'flask'; result.frameworks.push('flask'); }
      if (lower.includes('pytest')) result.testRunner = result.testRunner || 'pytest';
      if (lower.includes('sqlalchemy') || lower.includes('alembic')) { result.database = result.database || 'postgresql'; result.frameworks.push('sqlalchemy'); }
      if (lower.includes('pandas') || lower.includes('numpy') || lower.includes('scikit')) result.frameworks.push('data-science');
    } catch (e) { /* skip */ }
  }

  // Cargo.toml — Rust
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    result.language = result.language || 'rust';
    result.languages.push('rust');
    try {
      const content = fs.readFileSync(path.join(cwd, 'Cargo.toml'), 'utf8').toLowerCase();
      if (content.includes('actix')) result.frameworks.push('actix');
      if (content.includes('axum')) result.frameworks.push('axum');
      if (content.includes('tokio')) result.frameworks.push('tokio');
    } catch (e) { /* skip */ }
  }

  // go.mod — Go
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    result.language = result.language || 'go';
    result.languages.push('go');
  }

  // Gemfile — Ruby
  if (fs.existsSync(path.join(cwd, 'Gemfile'))) {
    result.language = result.language || 'ruby';
    result.languages.push('ruby');
    try {
      const content = fs.readFileSync(path.join(cwd, 'Gemfile'), 'utf8').toLowerCase();
      if (content.includes('rails')) result.frameworks.push('rails');
      if (content.includes('rspec')) result.testRunner = result.testRunner || 'rspec';
    } catch (e) { /* skip */ }
  }

  // Swift
  if (fs.existsSync(path.join(cwd, 'Package.swift')) || fs.existsSync(path.join(cwd, 'project.pbxproj'))) {
    result.language = result.language || 'swift';
    result.languages.push('swift');
  }

  // Java
  if (fs.existsSync(path.join(cwd, 'pom.xml')) || fs.existsSync(path.join(cwd, 'build.gradle'))) {
    result.language = result.language || 'java';
    result.languages.push('java');
    result.frameworks.push('spring');
  }

  // Docker
  result.hasDocker = fs.existsSync(path.join(cwd, 'Dockerfile'))
    || fs.existsSync(path.join(cwd, 'docker-compose.yml'))
    || fs.existsSync(path.join(cwd, 'docker-compose.yaml'));

  // CI/CD
  result.hasCICD = fs.existsSync(path.join(cwd, '.github', 'workflows'))
    || fs.existsSync(path.join(cwd, '.gitlab-ci.yml'))
    || fs.existsSync(path.join(cwd, 'Jenkinsfile'))
    || fs.existsSync(path.join(cwd, '.circleci'));

  // Deduplicate
  result.languages = [...new Set(result.languages)];
  result.frameworks = [...new Set(result.frameworks)];

  return result;
}

module.exports = { detect };

// CLI mode
if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  console.log(JSON.stringify(detect(cwd), null, 2));
}
