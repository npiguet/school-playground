// Immersion wave (spec §1 "not a school application", playability #2-#7, #19): the words on the
// places' screens are the camp's, not the school's, the office's or the IT department's. Scans the
// places' components, the title/library/Delphi screens, the PIN seal, the level medallions, the
// settings and the world data (scenes, voices, Éris, the bestiary) - markup text and string
// literals only (comments and code are not on screen).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';

const BANNED: [RegExp, string][] = [
  [/\bfacultatif\b/i, 'admin word: say what it does instead'],
  [/\bprofils?\b/i, 'admin word: « héros » or « bouclier »'],
  [/\bHarmoS\b/, 'school system'],
  [/comme à l'école/i, 'school register'],
  // No trailing \b: after « é » (not a \w character) it would never match « Scanné ».
  [/\bscann(?:er|é|ée)(?!\p{L})/iu, 'technical word: « déchiffrer »'],
  [/\bsauvegarder\b/i, 'technical word: « poser sur l\'étagère »'],
  [/jamais joué/i, 'say « Jamais défendu »'],
  [/\bréviser\b/i, 'school register: « Te préparer »'],
  [/≈/, 'catalogue metadata'],
  [/multipliée par/i, 'mechanic-speak'],
  [/domaine public/i, 'credits live in ASSETS-LICENSES.md (Ruling W9)'],
  // The singular only: « Autres niveaux » is the shelves' toggle, named verbatim by the plan
  // (Global Constraints, feature parity). « niveau 3 », « à ce niveau », a « Niveau » heading are not.
  [/\bniveau\b/i, 'school register: a medallion says the class (« Ta classe »)'],
  [/\btableau des quêtes\b/i, 'one name: « Le mur des quêtes » (Ruling W13)'],
];

const FILES = [
  ...walk('src/components/places'),
  'src/components/PinGate.svelte',
  'src/components/QuestCard.svelte',
  'src/components/ui/LevelMedallions.svelte',
  'src/screens/Title.svelte',
  'src/screens/LibraryTent.svelte',
  'src/screens/Delphi.svelte',
  'src/screens/Settings.svelte',
  ...walk('src/lib/world'),
  'src/lib/library/shelf.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const banned = (text: string) => BANNED.filter(([re]) => re.test(text)).map(([re, why]) => `${re} (${why})`);

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
    const quiet = screenText(
      '<script>// réviser, niveau\nimport { api } from "./api";\napi.profiles.scan(x);</script>\n<!-- Profil -->\n<button onclick={() => sauvegarder(niveau)}>Autres niveaux</button>',
      'svelte',
    );
    expect(banned(quiet)).toEqual([]);
  });
});
