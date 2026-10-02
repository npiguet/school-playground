// MANUEL.md, the player's guide at the repo root, is read by the child who plays: the camp's copy
// rules apply to it as to every screen (no emoji, no school or admin words, no guilt, no pressure, no
// adjective agreeing with the player, French guillemets and spacing), it keeps technical words for its
// parents' note, and the default rules it quotes are the ones the game applies. A drift fails here.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_RULES } from './lib/rules';
import { DEFAULT_STAGE_XP, stageLabel } from './lib/world/dragon';
import { sealTitle } from './lib/world/seals';
import { DRAGON_STAGES } from './lib/world/types';
import { FOMO, GENDERED, GUILT, banned } from './testing/copyRules';

const raw = readFileSync('../MANUEL.md', 'utf-8');
// The prose as read: no Markdown emphasis, one space between words (a phrase may cross a line break).
const prose = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ');
// The child's part: everything before the parents' note.
const forChild = raw.slice(0, raw.indexOf('## 16. Pour les parents'));
const paragraphs = raw.split(/\n\s*\n/).map((p) => p.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim());

const pct = (x: number) => `${Math.round(100 * x)} %`;
const num = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

describe('MANUEL.md, the player guide', () => {
  it('exists, with its parents note last', () => {
    expect(forChild.length).toBeGreaterThan(1000);
    expect(raw.trimEnd().endsWith('annoncé d\'avance.')).toBe(true);
  });

  it('has no emoji and no icon-lookalike glyph', () => {
    expect(raw.match(/\p{Extended_Pictographic}|\u{FE0F}|[✓✔✕✖★☆▢▸▶✶❓❔]/gu)).toBeNull();
  });

  it("keeps the camp's words: no banned word, no guilt, no pressure, nothing agreeing with the player", () => {
    expect(banned(raw)).toEqual([]);
    expect([...raw.matchAll(GUILT)].map((m) => m[0])).toEqual([]);
    for (const p of paragraphs) {
      expect(FOMO.test(p), p).toBe(false);
      expect(GENDERED.test(p), p).toBe(false);
    }
  });

  it('keeps technical words out of the part the child reads', () => {
    const tech = /\b(API|JSON|Docker|migrations?|settings|SQLite|HTTP|OCR|Tesseract|serveur|regles\.json|README)\b|`/gi;
    expect([...forChild.matchAll(tech)].map((m) => m[0])).toEqual([]);
  });

  it('writes French typography: spaced guillemets and a space before ; : ! ?', () => {
    expect(raw.match(/«(?!\s)|(?<!\s)»/g)).toBeNull();
    expect(raw.match(/[^\s][;:!?](?=\s|$)/gm)).toBeNull();
    expect(raw.match(/"/g), 'straight quotes: use « guillemets »').toBeNull();
    expect(raw.split('\n').filter((l) => l.startsWith('|')), 'no table: too wide for a phone').toEqual([]);
  });

  it('quotes the default rules the game applies', () => {
    const r = DEFAULT_RULES;
    const expected = [
      ...r.levels.map((n, i) => `${sealTitle(i + 1)} : ${n.days} jours de garde, ${n.chances} pièges, ${pct(n.correct)} déjoués`),
      ...DRAGON_STAGES.filter((s) => s !== 'egg').map((s) => `${stageLabel(s)} : ${num(DEFAULT_STAGE_XP[s])} XP`),
      `au plus ${r.copy_belle_max_per_100} fautes pour 100 mots`,
      `au plus ${r.copy_correcte_max_per_100} fautes pour 100 mots`,
      `plus de ${r.copy_correcte_max_per_100} fautes pour 100 mots`,
      `au plus ${r.fight_max_per_100} fautes pour 100 mots`,
      `Chaque aide laissée au camp ajoute ${pct(r.aid_bonus)} de gloire`,
      `« Par groupes » ajoute ${pct(r.pace_bonus['2'])}, « D'un bon pas » ${pct(r.pace_bonus['3'])}`,
      `avant son jour rapporte ${pct(r.prophecy_bonus)} de gloire en plus`,
      `te donne ${r.chouette_hints} indices`,
      `au moins ${pct(r.quest_min_correct)} de ses pièges`,
      `une drachme pour ${r.drachmes.xp_per_drachme} XP`,
      `une quête du mur : ${r.drachmes.board} drachmes`,
      `une quête de l'Oracle : ${r.drachmes.oracle} drachmes`,
      `l'objectif de la semaine : ${r.drachmes.weekly} drachmes`,
      `un sceau : ${r.drachmes.level} drachmes pour le bois, jusqu'à ${5 * r.drachmes.level} pour l'orichalque`,
      `un combat gagné contre Éris : ${r.drachmes.boss} drachmes`,
    ];
    for (const s of expected) expect(prose, s).toContain(s);
    expect(r.quest_min_chances).toBe(3);
    expect(prose).toContain('le lieutenant s\'y montre au moins trois fois');
  });
});
