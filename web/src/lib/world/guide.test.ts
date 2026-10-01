import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../rules';
import { FOMO, GENDERED, GUILT, banned } from '../../testing/copyRules';
import { guideSections } from './guide';
import type { WorldCatalog } from './types';

const text = (catalog: WorldCatalog | null, id: string) => {
  const s = guideSections(catalog).find((x) => x.id === id)!;
  return s.blocks.map((b) => (b.kind === 'p' ? b.text : b.items.join('\n'))).join('\n');
};

// A rules file and a stall that differ from every default (review focus 4).
const ODD = {
  rules: {
    ...DEFAULT_RULES,
    aid_bonus: 0.3,
    prophecy_bonus: 0.4,
    pace_bonus: { '1': 0, '2': 0.1, '3': 0.2 },
    fight_max_per_100: 5,
    chouette_hints: 2,
    levels: [{ days: 2, chances: 10, correct: 0.8 }, ...DEFAULT_RULES.levels.slice(1)],
    fights: [{ level: 1, count: 3 }, { level: 1, count: 'all' }],
    drachmes: { xp_per_drachme: 8, board: 6, oracle: 16, weekly: 7, level: 11, boss: 33 },
  },
  stages: [
    { key: 'egg', name: 'Œuf', xp: 0 },
    { key: 'hatchling', name: 'Dragonnet', xp: 50 },
    { key: 'young', name: 'Jeune dragon', xp: 1000 },
    { key: 'adult', name: 'Dragon adulte', xp: 4000 },
    { key: 'illustre', name: 'Dragon illustre', xp: 12000 },
    { key: 'ancestral', name: 'Dragon ancestral', xp: 30000 },
  ],
  quest_bonus: { board: 70, oracle: 160, boss: 310, weekly: 45 },
  level_xp: 120,
  boss_rewards: { '1': 'sandales_hermes' },
  rewards: { sandales_hermes: { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
  shop: {
    slots: ['cou', 'queue', 'dos', 'tete'],
    slot_levels: { cou: 2, queue: 3, dos: 4, tete: 5 },
    draw_order: ['queue', 'dos', 'cou', 'tete'],
    accessories: [
      { id: 'accessory:hydre-cou', item: 'hydre-cou', lieutenant: 'hydre', slot: 'cou', level: 2, price: 45, the: '' },
      { id: 'accessory:hydre-queue', item: 'hydre-queue', lieutenant: 'hydre', slot: 'queue', level: 3, price: 65, the: '' },
      { id: 'accessory:hydre-dos', item: 'hydre-dos', lieutenant: 'hydre', slot: 'dos', level: 4, price: 95, the: '' },
      { id: 'accessory:hydre-tete', item: 'hydre-tete', lieutenant: 'hydre', slot: 'tete', level: 5, price: 135, the: '' },
    ],
    decor: [{ id: 'decor:amphore', price: 55, the: '' }],
    houses: [
      { id: 'house:villa', key: 'villa', stage: 'adult', after: null, price: 350, the: '' },
      { id: 'house:palais', key: 'palais', stage: 'illustre', after: 'house:villa', price: 900, the: '' },
    ],
    max_decor: { cabin: 5, villa: 7, palais: 10 },
  },
} as unknown as WorldCatalog;

describe('le guide du camp (spec 2026-09-29 explanations §3)', () => {
  it('has five sections in order, in the dragon\'s words', () => {
    expect(guideSections(null).map((s) => [s.id, s.title])).toEqual([
      ['gloire', 'La gloire et ton dragon'],
      ['sceaux', 'Les sceaux'],
      ['drachmes', 'Les drachmes'],
      ['aides', 'Les aides'],
      ['eris', 'Les combats contre Éris'],
    ]);
  });

  it('says the defaults until the catalogue has come', () => {
    expect(text(null, 'gloire')).toContain('Dragonnet\u202f: 100 XP');
    expect(text(null, 'gloire')).toContain('Dragon ancestral\u202f: 40\u202f000 XP');
    expect(text(null, 'sceaux')).toContain('Sceau de bois\u202f: 3 jours de garde, 12 pièges, 85\u202f% déjoués');
    expect(text(null, 'drachmes')).toContain('Pour le cou, au sceau de bronze\u202f: 40 drachmes');
    expect(text(null, 'aides')).toContain('20\u202f% de gloire');
    expect(text(null, 'eris')).toContain("Combat X\u202f: tous les lieutenants au sceau d'orichalque");
  });

  // Review focus 4: every number follows what the server serves.
  it('reads every number from the served catalogue', () => {
    const g = text(ODD, 'gloire');
    expect(g).toContain('Dragonnet\u202f: 50 XP');
    expect(g).toContain('Dragon ancestral\u202f: 30\u202f000 XP');
    expect(g).toContain("70 XP pour une quête du mur, 160 pour une quête de l'Oracle, 45 pour l'objectif de la semaine");
    const s = text(ODD, 'sceaux');
    expect(s).toContain('Sceau de bois\u202f: 2 jours de garde, 10 pièges, 80\u202f% déjoués');
    expect(s).toContain("120 XP pour le sceau de bois, 240 pour le bronze, et ainsi de suite jusqu'à 600 pour l'orichalque");
    const d = text(ODD, 'drachmes');
    expect(d).toContain('une pour 8 XP gagnés');
    expect(d).toContain('Une quête du mur\u202f: 6 drachmes');
    expect(d).toContain("Un sceau\u202f: 11 drachmes pour le bois, jusqu'à 55 drachmes pour l'orichalque");
    expect(d).toContain('Un combat gagné contre Éris\u202f: 33 drachmes');
    expect(d).toContain('Pour le cou, au sceau de bronze\u202f: 45 drachmes');
    expect(d).toContain("Pour la tête, au sceau d'orichalque\u202f: 135 drachmes");
    expect(d).toContain('Le décor coûte 55 drachmes la pièce');
    expect(d).toContain('La villa, 350 drachmes');
    expect(d).toContain('le palais, 900 drachmes');
    expect(d).toContain('5 pièces dans la cabane, 7 dans la villa, 10 dans le palais');
    const a = text(ODD, 'aides');
    expect(a).toContain('30\u202f% de gloire');
    expect(a).toContain('10\u202f% au rythme \u00ab\u202fPar groupes\u202f\u00bb et 20\u202f% au rythme \u00ab\u202fD\'un bon pas\u202f\u00bb');
    expect(a).toContain('ajoute 40\u202f%');
    expect(a).toContain('2 indices pour repérer un piège');
    const e = text(ODD, 'eris');
    expect(e).toContain('Combat I\u202f: trois lieutenants au sceau de bois');
    expect(e).toContain('Combat II\u202f: tous les lieutenants au sceau de bois');
    expect(e).not.toContain('Combat III');
    expect(e).toContain('5 fautes au plus pour 100 mots');
    expect(e).toContain('310 XP et 33 drachmes');
    expect(e).toContain("La première apporte aussi une arme des dieux\u202f: Sandales d'Hermès.");
  });

  // Fix round 1, M5: « à partir du bronze » is the lowest level the stall's list reads.
  it('says from which seal the stall sells, from the served slot levels', () => {
    expect(text(null, 'drachmes')).toContain('à partir du bronze, met en vente');
    const late = { ...ODD, shop: { ...ODD.shop, slot_levels: { cou: 3, queue: 3, dos: 4, tete: 5 } } } as unknown as WorldCatalog;
    expect(text(late, 'drachmes')).toContain("à partir de l'argent, met en vente");
    expect(text(late, 'drachmes')).toContain("Pour le cou, au sceau d'argent\u202f: 45 drachmes");
  });

  // Fix round 1, M6: the server's own three pieces, and a ladder whose gear tiers are not 1..N.
  it("names the gods' weapons with the fights that bring them", () => {
    const three = {
      ...ODD,
      boss_rewards: { '1': 'sandales_hermes', '2': 'egide', '3': 'foudre_zeus' },
      rewards: {
        sandales_hermes: { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' },
        egide: { id: 'egide', kind: 'gear', name: 'Égide', desc: '', source: '' },
        foudre_zeus: { id: 'foudre_zeus', kind: 'gear', name: 'Foudre de Zeus', desc: '', source: '' },
      },
    } as unknown as WorldCatalog;
    expect(text(three, 'eris')).toContain("Les trois premières apportent aussi une arme des dieux\u202f: Sandales d'Hermès, Égide et Foudre de Zeus.");
    const gaps = { ...three, boss_rewards: { '1': 'sandales_hermes', '3': 'egide', '10': 'foudre_zeus' } } as unknown as WorldCatalog;
    const e = text(gaps, 'eris');
    expect(e).not.toContain('premières');
    expect(e).toContain("Certaines apportent aussi une arme des dieux\u202f: le combat I, Sandales d'Hermès\u202f; le combat III, Égide\u202f; le combat X, Foudre de Zeus.");
  });

  // Fix round 1, M7: the rules file may hold a decimal limit.
  it('writes a decimal limit with a French comma', () => {
    const half = { ...ODD, rules: { ...ODD.rules, fight_max_per_100: 4.5 } } as unknown as WorldCatalog;
    expect(text(half, 'eris')).toContain('4,5 fautes au plus pour 100 mots');
  });

  it('speaks the camp, never the school, never guilt or pressure, in French typography', () => {
    for (const catalog of [null, ODD]) {
      for (const s of guideSections(catalog)) {
        for (const b of s.blocks) {
          for (const t of b.kind === 'p' ? [b.text] : b.items) {
            expect(banned(t), t).toEqual([]);
            expect(t.match(GUILT), t).toBeNull();
            expect(t, t).not.toMatch(GENDERED);
            expect(t, t).not.toMatch(FOMO);
            expect(t, t).not.toMatch(/ [:;!?%»]|« /);
          }
        }
      }
    }
  });
});
