---
name: "scout:eval"
description: "Mid-session evaluatie — analyseert huidige sessie-activiteit, detecteert gemiste kansen, en geeft on-demand advisor suggesties."
---

# Scout Eval — Mid-session evaluatie & On-demand Advisor

Evalueer of het initiële advies nog geldig is, detecteer gemiste kansen, en geef contextgevoelige suggesties.

## Stappen:

1. **Verzamel sessie-context** — analyseer welke bestanden in deze sessie zijn bewerkt/gelezen:
   - Kijk naar recente tool calls in de conversatie (Edit, Write, Bash, Read)
   - Noteer bestandspaden, patronen, en outputs

2. **Draai de advisor-analyse** op de verzamelde bestanden:
   ```bash
   node -e "
   const { analyzeAction, formatMultiSuggestion } = require('$HOME/.claude/hooks/advisor-post-tool-use.js');
   const files = process.argv.slice(1);
   const seen = new Set();
   for (const f of files) {
     const matches = analyzeAction({ tool_name: 'Edit', tool_input: { file_path: f }, tool_output: '' });
     for (const m of matches) {
       if (!seen.has(m.id)) {
         seen.add(m.id);
       }
     }
     if (matches.length > 0) {
       console.log(formatMultiSuggestion(matches, f));
       console.log('');
     }
   }
   " [bestanden die in sessie bewerkt zijn]
   ```

3. **Lees project profiel** (`.claude/scout-profile.json`) voor initieel advies

4. **Analyseer**:
   - Welke aanbevolen tools zijn daadwerkelijk gebruikt (skills aangeroepen in sessie)?
   - Welke bestanden zijn bewerkt die bij een niet-gebruikte tool passen?
   - Zijn er nieuwe patronen gedetecteerd (bestanden/acties die bij sessiestart niet zichtbaar waren)?

5. **Genereer evaluatierapport**

## Output formaat:
```
Scout Evaluatie — mid-session check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Initieel advies: [N] tools aanbevolen
Gebruikt: [X]/[N] ([lijst])

Gemiste kansen:
 - Je hebt [N]x [actie] gedaan zonder [tool]
 - [Bestand] bewerkt — [tool] had kunnen helpen

Advisor suggesties (on-demand):
 → [tool] — [reden op basis van bewerkte bestanden]

Score initieel advies: [X]/10
```

6. Update het project profiel met evaluatieresultaten

## Belangrijke regels:
- Baseer je op DAADWERKELIJKE sessie-activiteit, niet op aannames
- Lees `.claude/scout-profile.json` voor het initiële advies
- De advisor draait NIET meer als hook — alleen via deze skill on-demand
- Sla evaluatieresultaten op in het profiel
- Wees bondig — geen overbodige uitleg
