---
name: "scout:bootstrap"
description: "Diepte-analyse voor projecten die nog niet eerder met de scout methodiek hebben gelopen."
---

# Scout Bootstrap — Diepte-analyse

Diepte-analyse voor projecten die nog niet eerder met de scout methodiek hebben gelopen.

## Stappen:
1. Voer standaard projectdetectie uit:
   ```bash
   node ~/.claude/scripts/project-detector.js "$(pwd)"
   ```
2. **Diepte-analyse** (ga verder dan root config files):
   - Gebruik Glob om de directory structuur te scannen: `**/*.{ts,tsx,js,jsx,py,go,rs}`
   - Tel bestanden per type en directory
   - Gebruik Grep om imports/requires te analyseren voor externe dependencies
   - Check git history: `git log --oneline -20` en `git log --diff-filter=M --name-only -20` voor vaak gewijzigde bestanden
   - Lees bestaande `.claude/` configuratie en CLAUDE.md
3. **Dependency graph**:
   - Detecteer externe services (API URLs, database connection strings)
   - Analyseer CI/CD pipeline configuratie
4. **Laad skill catalog** (`~/.claude/skills/.index.json`). Als die niet bestaat:
   ```bash
   node ~/.claude/scripts/build-skill-catalog.js
   ```
5. **Uitgebreide toolkit briefing**:
   - Volledig overzicht per categorie (niet gelimiteerd tot top 8)
   - Per tool een concrete use case voor DIT specifieke project
   - MCP servers die nog niet geconfigureerd zijn maar wel nuttig zouden zijn
6. **Profiel aanmaken**:
   - Schrijf volledig `scout-profile.json` met bootstrap marker
   - Markeer als `"bootstrapped": true`

## Output formaat:
```
Scout Bootstrap — [project-naam] (eerste scan)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: [Framework] + [Taal] + [ORM] + [Database]
Structuur: [N] bestanden, [M] directories
CI/CD: [type]
Hosting: [platform] (indien gedetecteerd)

SKILLS ([N] aanbevolen):
  Core:
   1. [skill] — [concrete use case voor dit project]
   ...
  Aanvullend:
   ...

AGENTS ([N] aanbevolen):
   1. [agent] — [concrete use case]
   ...

MCP SERVERS:
   [server] — [beschrijving]
   ! [niet-geconfigureerde server] — [waarom nuttig]

Profiel opgeslagen. Volgende sessie: scout gebruikt dit profiel automatisch.
```

## Belangrijke regels:
- Wees GRONDIG maar presenteer resultaten gestructureerd
- Gebruik de bestaande scripts (`project-detector.js`, `build-skill-catalog.js`) — schrijf geen dubbele logica
- Sla ALTIJD het project profiel op met `"bootstrapped": true`
