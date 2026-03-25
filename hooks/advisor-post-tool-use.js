#!/usr/bin/env node
/**
 * Action Advisor — PostToolUse Hook
 * Suggests relevant skills, agents, and MCP servers based on current action.
 * Debounced: max 1 suggestion per 2 min, no repeats within 10 min.
 */

const fs = require('fs');
const path = require('path');
const { getStrings } = require(path.join(__dirname, '..', 'scripts', 'i18n'));

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');
const INDEX_PATH = path.join(CLAUDE_DIR, 'skills', '.index.json');

// Action patterns: signal → suggested tools
const ACTION_PATTERNS = [
  {
    id: 'testing',
    filePatterns: [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /__tests__/, /test_.*\.py$/, /_test\.go$/],
    contentPatterns: [/describe\s*\(/, /it\s*\(/, /test\s*\(/, /expect\s*\(/, /assert/, /pytest/, /func Test/],
    suggestions: [
      { name: '/ecc:tdd-workflow', type: 'skill', summary: 'TDD workflow: write tests first, then implement. Covers test structure, mocking, and assertions with 80%+ coverage.' },
      { name: 'quality-engineer', type: 'agent', summary: 'Agent for comprehensive test strategy, edge cases, and systematic quality assurance.' },
    ],
  },
  {
    id: 'api',
    filePatterns: [/\/api\//, /\/routes\//, /handler/, /controller/, /endpoint/],
    contentPatterns: [/app\.(get|post|put|delete|patch)\s*\(/, /router\.(get|post|put|delete)/, /@(Get|Post|Put|Delete)/, /FastAPI/, /APIRouter/],
    suggestions: [
      { name: '/ecc:api-design', type: 'skill', summary: 'REST API design patterns: resource naming, status codes, pagination, filtering, error responses, and versioning.' },
      { name: 'backend-architect', type: 'agent', summary: 'Agent for reliable backend systems with focus on data integrity, security, and fault tolerance.' },
    ],
  },
  {
    id: 'database',
    filePatterns: [/\.sql$/, /migration/, /schema/, /drizzle/, /prisma/],
    contentPatterns: [/SELECT\s+/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i, /ALTER\s+TABLE/i, /db\.(query|execute|select)/, /\.findMany\(/, /\.createMany\(/],
    suggestions: [
      { name: '/ecc:postgres-patterns', type: 'skill', summary: 'PostgreSQL query optimization, schema design, indexing, and security. Based on Supabase best practices.' },
      { name: 'database-reviewer', type: 'agent', summary: 'Agent for query optimization, schema review, security, and performance analysis of database code.' },
    ],
  },
  {
    id: 'security',
    filePatterns: [/auth/, /login/, /middleware/, /session/, /token/],
    contentPatterns: [/password/, /encrypt/, /hash/, /jwt/, /bearer/, /secret/, /api[_-]?key/, /OAuth/, /csrf/, /sanitize/],
    suggestions: [
      { name: '/ecc:security-review', type: 'skill', summary: 'Scans code for OWASP Top 10 vulnerabilities, auth flaws, input validation issues, and secret exposure.' },
      { name: 'security-reviewer', type: 'agent', summary: 'Agent for security vulnerability detection and remediation. Flags secrets, SSRF, injection, and unsafe crypto.' },
    ],
  },
  {
    id: 'frontend',
    filePatterns: [/\.tsx$/, /components\//, /pages\//, /app\/.*\/page\./],
    contentPatterns: [/useState/, /useEffect/, /useCallback/, /useMemo/, /<div/, /className=/, /tailwind/, /styled/],
    suggestions: [
      { name: '/ecc:frontend-patterns', type: 'skill', summary: 'React/Next.js patterns: state management, performance optimization, component design, and UI best practices.' },
      { name: 'frontend-architect', type: 'agent', summary: 'Agent for accessible, performant user interfaces with focus on UX and modern frameworks.' },
    ],
  },
  {
    id: 'docker',
    filePatterns: [/Dockerfile/, /docker-compose/, /\.dockerignore/],
    contentPatterns: [/FROM\s+\w/, /WORKDIR/, /EXPOSE\s+\d/, /docker\s+(build|run|compose)/],
    suggestions: [
      { name: '/ecc:docker-patterns', type: 'skill', summary: 'Docker and Docker Compose patterns for local development, container security, networking, and multi-service orchestration.' },
      { name: 'devops-architect', type: 'agent', summary: 'Agent for infrastructure automation and deployment with focus on reliability and observability.' },
    ],
  },
  {
    id: 'build-error',
    filePatterns: [],
    contentPatterns: [/error TS\d+/, /SyntaxError/, /TypeError/, /ReferenceError/, /ModuleNotFoundError/, /compilation failed/, /FAIL\s/, /Build failed/i],
    outputOnly: true,
    suggestions: [
      { name: 'build-error-resolver', type: 'agent', summary: 'Agent for build and TypeScript error resolution. Fixes build/type errors with minimal diffs.' },
    ],
  },
  {
    id: 'git-workflow',
    filePatterns: [],
    contentPatterns: [/git\s+(merge|rebase|cherry-pick|bisect)/, /conflict/, /CONFLICT.*Merge/],
    outputOnly: true,
    suggestions: [
      { name: '/ecc:git', type: 'skill', summary: 'Git operations with intelligent commit messages and workflow optimization.' },
    ],
  },
  {
    id: 'data-science',
    filePatterns: [/\.ipynb$/, /\.py$/],
    contentPatterns: [/import pandas/, /import numpy/, /import sklearn/, /import torch/, /import tensorflow/, /\.fit\(/, /\.predict\(/],
    suggestions: [
      { name: '/exploratory-data-analysis', type: 'skill', summary: 'Comprehensive exploratory data analysis on scientific data in 200+ file formats.' },
      { name: '/statistical-analysis', type: 'skill', summary: 'Guided statistical analysis with test selection, assumption verification, and reporting.' },
    ],
  },
];

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  } catch (e) {
    return {};
  }
}

function getStateFile(sessionId, cwd) {
  // Prefer project .claude/ dir, fallback to /tmp/
  if (cwd) {
    const projectDir = path.join(cwd, '.claude');
    try {
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
      fs.accessSync(projectDir, fs.constants.W_OK);
      return path.join(projectDir, 'scout-session-state.json');
    } catch (e) { /* fall through to /tmp/ */ }
  }
  return path.join('/tmp', `claude-advisor-${sessionId || 'default'}.json`);
}

function loadState(sessionId, cwd) {
  try {
    return JSON.parse(fs.readFileSync(getStateFile(sessionId, cwd), 'utf8'));
  } catch (e) {
    return { lastSuggestion: 0, suggestedSkills: {}, actions: [] };
  }
}

function saveState(sessionId, cwd, state) {
  try {
    fs.writeFileSync(getStateFile(sessionId, cwd), JSON.stringify(state));
  } catch (e) { /* skip */ }
}

function trackUsage(cwd, toolName) {
  const profilePath = path.join(cwd, '.claude', 'scout-profile.json');
  try {
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const existing = (profile.usedTools || []).find(t => t.name === toolName);
    if (existing) {
      existing.count++;
      existing.usedAt = new Date().toISOString().split('T')[0];
    }
    // Don't add new entries here — only track skills that were explicitly invoked
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  } catch (e) { /* skip */ }
}

function analyzeAction(input) {
  const toolName = input.tool_name || '';
  const toolInput = JSON.stringify(input.tool_input || {});
  const toolOutput = (input.tool_output || '').substring(0, 2000); // cap
  const filePath = input.tool_input?.file_path || input.tool_input?.command || '';

  const matches = [];

  for (const pattern of ACTION_PATTERNS) {
    let confidence = 0;

    // Check file patterns
    if (!pattern.outputOnly) {
      for (const fp of pattern.filePatterns) {
        if (fp.test(filePath)) { confidence += 3; break; }
      }
    }

    // Check content patterns
    const searchText = pattern.outputOnly ? toolOutput : `${toolInput} ${filePath}`;
    for (const cp of pattern.contentPatterns) {
      if (cp.test(searchText)) { confidence += 2; break; }
    }

    // For build errors, also check tool output
    if (pattern.id === 'build-error' && toolName === 'Bash') {
      for (const cp of pattern.contentPatterns) {
        if (cp.test(toolOutput)) { confidence += 3; break; }
      }
    }

    if (confidence >= 3) {
      matches.push({ ...pattern, confidence });
    }
  }

  // Return top 2 matches if both have sufficient confidence
  matches.sort((a, b) => b.confidence - a.confidence);
  if (matches.length >= 2 && matches[1].confidence >= 3) {
    return matches.slice(0, 2);
  }
  return matches.length > 0 ? [matches[0]] : [];
}

function formatSuggestion(match, filePath) {
  const s = getStrings();
  const suggestion = match.suggestions[0];
  const reason = getReasonText(match.id, filePath);

  const lines = [
    `${s.skillTip} ${suggestion.name}`,
    `  ${s.what} ${suggestion.summary}`,
    `  ${s.whyNow} ${reason}`,
    `  ${s.useText(suggestion.name)}${match.suggestions.length > 1 ? ` (${s.alsoAvailable} ${match.suggestions.slice(1).map(s => s.name).join(', ')})` : ''}.`,
  ];
  return lines.join('\n');
}

function formatMultiSuggestion(matches, filePath) {
  if (matches.length === 0) return null;
  if (matches.length === 1) return formatSuggestion(matches[0], filePath);

  const s = getStrings();
  const parts = matches.map(m => {
    const sug = m.suggestions[0];
    return `${sug.name} (${getReasonText(m.id, filePath).replace(/\.$/, '')})`;
  });
  const lines = [
    `${s.skillTips}`,
    `  ${s.combinedAdvice} ${parts.join(` ${s.and} `)}`,
  ];
  for (const m of matches) {
    const sug = m.suggestions[0];
    lines.push(`  → ${sug.name} — ${sug.summary}`);
  }
  return lines.join('\n');
}

function getReasonText(patternId, filePath) {
  const s = getStrings();
  const file = path.basename(filePath || '');
  const reasons = {
    testing: s.reasonTesting(file),
    api: s.reasonApi(file),
    database: s.reasonDatabase(file),
    security: s.reasonSecurity(file),
    frontend: s.reasonFrontend(file),
    docker: s.reasonDocker(file),
    'build-error': s.reasonBuildError(),
    'git-workflow': s.reasonGitWorkflow(),
    'data-science': s.reasonDataScience(file),
  };
  return reasons[patternId] || s.reasonDefault();
}

// Exports for testing
module.exports = { analyzeAction, formatSuggestion, formatMultiSuggestion, getReasonText, ACTION_PATTERNS };

// Main
if (require.main === module) {
const input = readStdin();
const sessionId = input?.session_id || 'default';
const cwd = input?.cwd || input?.workspace?.current_dir || process.cwd();
const state = loadState(sessionId, cwd);
const now = Date.now();

// Record action for eval tracking
state.actions = state.actions || [];
state.actions.push({
  tool: input.tool_name,
  file: input.tool_input?.file_path || input.tool_input?.command || '',
  time: now,
});
// Cap action log at 200 entries
if (state.actions.length > 200) state.actions = state.actions.slice(-200);

// Track Skill tool invocations for eval
if (input.tool_name === 'Skill' && input.tool_input?.skill) {
  trackUsage(cwd, input.tool_input.skill);
}

// Debounce: max 1 suggestion per 2 minutes
if (now - (state.lastSuggestion || 0) < 2 * 60 * 1000) {
  saveState(sessionId, cwd, state);
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse' } }));
  process.exit(0);
}

// Analyze action
const matches = analyzeAction(input);
if (matches.length === 0) {
  saveState(sessionId, cwd, state);
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse' } }));
  process.exit(0);
}

// No repeat within 10 minutes (check each match individually)
const validMatches = matches.filter(m => {
  const lastSuggested = state.suggestedSkills?.[m.id] || 0;
  return now - lastSuggested >= 10 * 60 * 1000;
});
if (validMatches.length === 0) {
  saveState(sessionId, cwd, state);
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse' } }));
  process.exit(0);
}

// Emit suggestion
const filePath = input.tool_input?.file_path || input.tool_input?.command || '';
const suggestion = formatMultiSuggestion(validMatches, filePath);

state.lastSuggestion = now;
state.suggestedSkills = state.suggestedSkills || {};
for (const m of validMatches) {
  state.suggestedSkills[m.id] = now;
}
saveState(sessionId, cwd, state);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: `<action-advisor>\n${suggestion}\n</action-advisor>`,
  },
}));
}
