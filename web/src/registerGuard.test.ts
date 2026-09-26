// Immersion wave (spec §1 "not a school application", playability #2-#7, #19): the words on the
// places' screens are the camp's, not the school's, the office's or the IT department's. Scans the
// places' components, the battle's (UI4) but the pending list below, every screen, the PIN
// seal, the level medallions, the world data (scenes, voices, Éris, the bestiary) and the battle's
// lines (lib/battle, UI4) - markup text
// and string literals only (comments and code are not on screen).
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
  // Singular and plural (« Autres niveaux » became « Autres classes », controller ruling after the
  // B5 batch): « niveau 3 », « à ce niveau », a « Niveau » heading, « Autres niveaux » are not.
  [/\bniveaux?\b/i, 'school register: a medallion says the class (« Ta classe », « Autres classes »)'],
  [/\btableau des quêtes\b/i, 'one name: « Le mur des quêtes » (Ruling W13)'],
];

// Files exempted while they still use the old words: the battle phases UI4 restyles. It only
// shrinks: a file listed here must exist and still hold a banned word. Lane P's files, then the
// fence line, then lane V's (Ruling C13): each lane removes only its own lines.
const PENDING = new Set<string>([
  // --- lane V (Tasks 6-7) below this line ---
]);

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
      if (PENDING.has(f)) continue;
      const text = screenText(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts');
      for (const hit of banned(text)) report.push(`${f}: ${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('keeps the pending list honest (UI3b): each file exists and still needs its task', () => {
    for (const f of PENDING) {
      expect(existsSync(f), `${f} moved: remove it from PENDING`).toBe(true);
      const text = screenText(readFileSync(f, 'utf-8'), 'svelte');
      expect(banned(text).length, `${f} is clean: remove it from PENDING`).toBeGreaterThan(0);
    }
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
