# Session Scout & Action Advisor — Handleiding

## Overzicht

De Scout & Advisor helpen je de juiste tools te gebruiken op het juiste moment.

- **Session Scout** analyseert je project en adviseert tooling bij sessiestart
- **Action Advisor** geeft real-time suggesties tijdens het werk
- **Project Memory** onthoudt je keuzes en gebruik per project

## Commando's

### `/scout`
Scan het huidige project en toon aanbevolen skills, agents, hooks en MCP servers.
Draait automatisch bij sessiestart via hook. Handmatig uitvoeren voor een verse scan.

### `/scout:eval`
Mid-session evaluatie. Vergelijkt het initiële advies met je daadwerkelijke gebruik:
- Welke aanbevolen tools je WEL hebt gebruikt
- Gemiste kansen (relevante tools die niet gebruikt zijn)
- Nieuwe aanbevelingen op basis van sessie-activiteit
- Score van het initiële advies (X/10)

### `/scout:bootstrap`
Diepte-analyse voor projecten die nog niet eerder met de scout methodiek hebben gelopen:
- Volledige directory structuur en dependency graph
- Git history analyse (vaak gewijzigde bestanden)
- Bestaande configuratie en CI/CD setup
- Concrete use cases per tool voor het specifieke project
Maakt een volledig project profiel aan (`.claude/scout-profile.json`).

### `/scout:help`
Toont deze handleiding.

## Action Advisor

De advisor draait automatisch als PostToolUse hook. Bij elke actie checkt hij
of er een relevante tool is die je kan helpen.

### Suggestie formaat
Elke suggestie bevat:
- **Wat**: Korte uitleg wat de tool doet
- **Waarom nu**: Waarom de tool relevant is voor je huidige actie
- **Gebruik**: Hoe je de tool activeert

### Anti-spam
- Max 1 suggestie per 2 minuten
- Dezelfde tool wordt niet herhaald binnen 10 minuten
- Alleen bij voldoende confidence (meerdere signalen)

### Gedetecteerde patronen
| Signaal | Suggestie |
|---------|-----------|
| Test bestanden bewerken | `/ecc:tdd-workflow`, agent `quality-engineer` |
| API/route bestanden | `/ecc:api-design`, agent `backend-architect` |
| Database/SQL code | `/ecc:postgres-patterns`, agent `database-reviewer` |
| Auth/security code | `/ecc:security-review`, agent `security-reviewer` |
| React/TSX componenten | `/ecc:frontend-patterns`, agent `frontend-architect` |
| Docker configuratie | `/ecc:docker-patterns`, agent `devops-architect` |
| Build errors | agent `build-error-resolver` |
| Data science imports | `/exploratory-data-analysis`, `/statistical-analysis` |

## Project Memory

Per project wordt een profiel bijgehouden in `.claude/scout-profile.json`:
- Gedetecteerd projecttype en stack
- Aanbevolen tools per sessie
- Daadwerkelijk gebruikte tools (met frequentie)
- Evaluatie scores over tijd

Bij een nieuwe sessie op hetzelfde project laadt de scout dit profiel
en past het advies aan op basis van je geschiedenis. Vaak gebruikte tools
krijgen een hogere score (learning effect).

## Auto-Discovery

Wanneer je nieuwe skills, hooks, MCP servers of plugins installeert:
1. De catalog index wordt automatisch herbouwd bij de volgende sessie
2. Nieuwe tools verschijnen direct in de toolkit briefing
3. Geen handmatige stappen nodig

De rebuild wordt getriggerd wanneer:
- Het aantal bestanden in `~/.claude/skills/`, `agents/`, of `plugins/cache/` is veranderd
- `settings.json` of `settings.local.json` is gewijzigd
- De index ouder is dan 24 uur

## Technische details

### Bestanden
| Bestand | Doel |
|---------|------|
| `~/.claude/hooks/scout-session-start.js` | SessionStart hook |
| `~/.claude/hooks/advisor-post-tool-use.js` | PostToolUse hook |
| `~/.claude/scripts/build-skill-catalog.js` | Catalog builder |
| `~/.claude/scripts/project-detector.js` | Project detector |
| `~/.claude/skills/.index.json` | Skill catalog index |
| `{project}/.claude/scout-profile.json` | Project profiel |
| `/tmp/claude-advisor-{session}.json` | Sessie state (tijdelijk) |
