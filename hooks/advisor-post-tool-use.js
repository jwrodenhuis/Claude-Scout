#!/usr/bin/env node
/**
 * Action Advisor — PostToolUse Hook
 * Suggests relevant skills, agents, and MCP servers based on current action.
 * Debounced: max 1 suggestion per 2 min, no repeats within 10 min.
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_DIR = path.join(require('os').homedir(), '.claude');
const INDEX_PATH = path.join(CLAUDE_DIR, 'skills', '.index.json');

// Action patterns: signal → suggested tools
const ACTION_PATTERNS = [
  {
    id: 'testing',
    filePatterns: [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /__tests__/, /test_.*\.py$/, /_test\.go$/],
    contentPatterns: [/describe\s*\(/, /it\s*\(/, /test\s*\(/, /expect\s*\(/, /assert/, /pytest/, /func Test/],
    suggestions: [
      { name: '/ecc:tdd-workflow', type: 'skill', summary: 'TDD workflow: schrijf tests eerst, dan implementatie. Dekt test structuur, mocking en assertions met 80%+ coverage.' },
      { name: 'quality-engineer', type: 'agent', summary: 'Agent voor uitgebreide teststrategie, edge cases en systematische kwaliteitsborging.' },
    ],
  },
  {
    id: 'api',
    filePatterns: [/\/api\//, /\/routes\//, /handler/, /controller/, /endpoint/],
    contentPatterns: [/app\.(get|post|put|delete|patch)\s*\(/, /router\.(get|post|put|delete)/, /@(Get|Post|Put|Delete)/, /FastAPI/, /APIRouter/],
    suggestions: [
      { name: '/ecc:api-design', type: 'skill', summary: 'REST API design patterns: resource naming, status codes, pagination, filtering, error responses en versioning.' },
      { name: 'backend-architect', type: 'agent', summary: 'Agent voor betrouwbare backend systemen met focus op data-integriteit, security en fout-tolerantie.' },
    ],
  },
  {
    id: 'database',
    filePatterns: [/\.sql$/, /migration/, /schema/, /drizzle/, /prisma/],
    contentPatterns: [/SELECT\s+/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i, /ALTER\s+TABLE/i, /db\.(query|execute|select)/, /\.findMany\(/, /\.createMany\(/],
    suggestions: [
      { name: '/ecc:postgres-patterns', type: 'skill', summary: 'PostgreSQL query optimalisatie, schema design, indexering en security. Gebaseerd op Supabase best practices.' },
      { name: 'database-reviewer', type: 'agent', summary: 'Agent voor query optimalisatie, schema review, security en performance analyse van database code.' },
    ],
  },
  {
    id: 'security',
    filePatterns: [/auth/, /login/, /middleware/, /session/, /token/],
    contentPatterns: [/password/, /encrypt/, /hash/, /jwt/, /bearer/, /secret/, /api[_-]?key/, /OAuth/, /csrf/, /sanitize/],
    suggestions: [
      { name: '/ecc:security-review', type: 'skill', summary: 'Scant code op OWASP Top 10 kwetsbaarheden, auth flaws, input validatie en secret exposure.' },
      { name: 'security-reviewer', type: 'agent', summary: 'Agent voor security vulnerability detectie en remediatie. Flags secrets, SSRF, injection en unsafe crypto.' },
    ],
  },
  {
    id: 'frontend',
    filePatterns: [/\.tsx$/, /components\//, /pages\//, /app\/.*\/page\./],
    contentPatterns: [/useState/, /useEffect/, /useCallback/, /useMemo/, /<div/, /className=/, /tailwind/, /styled/],
    suggestions: [
      { name: '/ecc:frontend-patterns', type: 'skill', summary: 'React/Next.js patterns: state management, performance optimalisatie, component design en UI best practices.' },
      { name: 'frontend-architect', type: 'agent', summary: 'Agent voor toegankelijke, performante user interfaces met focus op UX en moderne frameworks.' },
    ],
  },
  {
    id: 'docker',
    filePatterns: [/Dockerfile/, /docker-compose/, /\.dockerignore/],
    contentPatterns: [/FROM\s+\w/, /WORKDIR/, /EXPOSE\s+\d/, /docker\s+(build|run|compose)/],
    suggestions: [
      { name: '/ecc:docker-patterns', type: 'skill', summary: 'Docker en Docker Compose patterns voor local development, container security, networking en multi-service orchestratie.' },
      { name: 'devops-architect', type: 'agent', summary: 'Agent voor infrastructure automation en deployment met focus op betrouwbaarheid en observability.' },
    ],
  },
  {
    id: 'build-error',
    filePatterns: [],
    contentPatterns: [/error TS\d+/, /SyntaxError/, /TypeError/, /ReferenceError/, /ModuleNotFoundError/, /compilation failed/, /FAIL\s/, /Build failed/i],
    outputOnly: true,
    suggestions: [
      { name: 'build-error-resolver', type: 'agent', summary: 'Agent voor build en TypeScript error resolutie. Fixt build/type errors met minimale diffs.' },
    ],
  },
  {
    id: 'git-workflow',
    filePatterns: [],
    contentPatterns: [/git\s+(merge|rebase|cherry-pick|bisect)/, /conflict/, /CONFLICT.*Merge/],
    outputOnly: true,
    suggestions: [
      { name: '/ecc:git', type: 'skill', summary: 'Git operaties met intelligente commit messages en workflow optimalisatie.' },
    ],
  },
  {
    id: 'data-science',
    filePatterns: [/\.ipynb$/, /\.py$/],
    contentPatterns: [/import pandas/, /import numpy/, /import sklearn/, /import torch/, /import tensorflow/, /\.fit\(/, /\.predict\(/],
    suggestions: [
      { name: '/exploratory-data-analysis', type: 'skill', summary: 'Uitgebreide exploratieve data analyse op wetenschappelijke data in 200+ bestandsformaten.' },
      { name: '/statistical-analysis', type: 'skill', summary: 'Begeleide statistische analyse met test selectie, aanname-verificatie en rapportage.' },
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

function getStateFile(sessionId) {
  return path.join('/tmp', `claude-advisor-${sessionId || 'default'}.json`);
}

function loadState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(getStateFile(sessionId), 'utf8'));
  } catch (e) {
    return { lastSuggestion: 0, suggestedSkills: {}, actions: [] };
  }
}

function saveState(sessionId, state) {
  try {
    fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state));
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

  // Return highest confidence match
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches[0] || null;
}

function formatSuggestion(match, filePath) {
  const suggestion = match.suggestions[0];
  const reason = getReasonText(match.id, filePath);

  const lines = [
    `Skill tip: ${suggestion.name}`,
    `  Wat: ${suggestion.summary}`,
    `  Waarom nu: ${reason}`,
    `  Gebruik: Roep ${suggestion.name.startsWith('/') ? suggestion.name : 'agent ' + suggestion.name} aan${match.suggestions.length > 1 ? ` (ook beschikbaar: ${match.suggestions.slice(1).map(s => s.name).join(', ')})` : ''}.`,
  ];
  return lines.join('\n');
}

function getReasonText(patternId, filePath) {
  const file = path.basename(filePath || '');
  const reasons = {
    testing: `Je werkt aan test bestanden${file ? ` (${file})` : ''}.`,
    api: `Je bewerkt API/route bestanden${file ? ` (${file})` : ''}.`,
    database: `Je werkt met database code${file ? ` (${file})` : ''}.`,
    security: `Je bewerkt security-gerelateerde code${file ? ` (${file})` : ''} met auth/token/password handling.`,
    frontend: `Je werkt aan frontend componenten${file ? ` (${file})` : ''}.`,
    docker: `Je bewerkt Docker configuratie${file ? ` (${file})` : ''}.`,
    'build-error': 'Er zijn build errors gedetecteerd in de output.',
    'git-workflow': 'Er is een complexe git operatie gaande.',
    'data-science': `Je werkt met data science code${file ? ` (${file})` : ''}.`,
  };
  return reasons[patternId] || 'Relevante patronen gedetecteerd in je huidige werk.';
}

// Exports for testing
module.exports = { analyzeAction, formatSuggestion, getReasonText, ACTION_PATTERNS };

// Main
if (require.main === module) {
const input = readStdin();
const sessionId = input?.session_id || 'default';
const cwd = input?.cwd || input?.workspace?.current_dir || process.cwd();
const state = loadState(sessionId);
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

// Debounce: max 1 suggestion per 2 minutes
if (now - (state.lastSuggestion || 0) < 2 * 60 * 1000) {
  saveState(sessionId, state);
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse' } }));
  process.exit(0);
}

// Analyze action
const match = analyzeAction(input);
if (!match) {
  saveState(sessionId, state);
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse' } }));
  process.exit(0);
}

// No repeat within 10 minutes
const lastSuggested = state.suggestedSkills?.[match.id] || 0;
if (now - lastSuggested < 10 * 60 * 1000) {
  saveState(sessionId, state);
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse' } }));
  process.exit(0);
}

// Emit suggestion
const filePath = input.tool_input?.file_path || input.tool_input?.command || '';
const suggestion = formatSuggestion(match, filePath);

state.lastSuggestion = now;
state.suggestedSkills = state.suggestedSkills || {};
state.suggestedSkills[match.id] = now;
saveState(sessionId, state);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: `<action-advisor>\n${suggestion}\n</action-advisor>`,
  },
}));
}
