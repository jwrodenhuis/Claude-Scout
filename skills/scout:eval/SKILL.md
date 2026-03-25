---
name: "scout:eval"
description: "Mid-session evaluatie — vergelijkt initieel advies met daadwerkelijk gebruik, detecteert gemiste kansen."
---

# Scout Eval — Mid-session evaluatie

Evalueer of het initiële advies nog geldig is en detecteer gemiste kansen.

## Stappen:
1. Lees de advisor state file (`/tmp/claude-advisor-{session}.json`) voor sessie-activiteit
2. Lees het project profiel (`.claude/scout-profile.json`) voor initieel advies
3. Analyseer:
   - Welke aanbevolen tools zijn daadwerkelijk gebruikt (skills aangeroepen in sessie)?
   - Welke bestanden zijn bewerkt die bij een niet-gebruikte tool passen?
   - Zijn er nieuwe patronen gedetecteerd (bestanden/acties die bij sessiestart niet zichtbaar waren)?
4. Genereer evaluatierapport

## Output formaat:
```
Scout Evaluatie — mid-session check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Initieel advies: [N] tools aanbevolen
Gebruikt: [X]/[N] ([lijst])

Gemiste kansen:
 - Je hebt [N]x [actie] gedaan zonder [tool]
 - [Bestand] bewerkt — [tool] had kunnen helpen

Nieuwe aanbevelingen:
 + [tool] — [reden: nieuwe patronen gedetecteerd]

Score initieel advies: [X]/10
```

5. Update het project profiel met evaluatieresultaten

## Belangrijke regels:
- Baseer je op DAADWERKELIJKE sessie-activiteit, niet op aannames
- Lees `.claude/scout-profile.json` voor het initiële advies
- Sla evaluatieresultaten op in het profiel
- Wees bondig — geen overbodige uitleg
