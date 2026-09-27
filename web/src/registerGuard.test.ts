// Immersion wave (spec §1 "not a school application", playability #2-#7, #19): the words on the
// places' screens are the camp's, not the school's, the office's or the IT department's. Scans the
// places' components, the battle's (UI4), every screen, the PIN seal, the level medallions, the
// world data (scenes, voices, Éris, the bestiary) and the battle's lines (lib/battle, UI4) - markup
// text and string literals only (comments and code are not on screen).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';
import { banned } from './testing/copyRules';

const FILES = [
  ...walk('src/components/places'),
  ...walk('src/components/battle'),
  'src/components/PinGate.svelte',
  'src/components/QuestCard.svelte',
  'src/components/ui/LevelMedallions.svelte',
  ...walk('src/screens'),
  ...walk('src/lib/world'),
  ...walk('src/lib/battle'),
  'src/lib/library/shelf.ts',
  // The pace medallions' names and descriptions (PACE_LABELS).
  'src/lib/dictation/script.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('the places speak the camp, not the school', () => {
  it('uses none of the banned words', () => {
    const report: string[] = [];
    for (const f of FILES) {
      const text = screenText(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts');
      for (const hit of banned(text)) report.push(`${f}: ${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('catches the planted words and ignores comments and code (self-test)', () => {
    const planted = screenText(
      "<script>const t = 'Scanné';</script>\n<h2>Niveau</h2>\n<p>Dort encore à ce niveau.</p>\n<p>{x ? 'Profil' : ''}</p>",
      'svelte',
    );
    expect(banned(planted)).toHaveLength(3);
    expect(banned(screenText('<button>Autres niveaux</button>', 'svelte'))).toHaveLength(1);
    const quiet = screenText(
      '<script>// réviser, niveau\nimport { api } from "./api";\napi.profiles.scan(x);</script>\n<!-- Profil -->\n<button onclick={() => sauvegarder(niveau)}>Autres classes</button>',
      'svelte',
    );
    expect(banned(quiet)).toEqual([]);
  });
});
