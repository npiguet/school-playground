import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN,
  agree,
  bandFor,
  confirmChoiceLabel,
  dossierIntro,
  dossierLine,
  dragonAside,
  genderFor,
  isAwake,
  lieutenantName,
  pronounFor,
  sleepingCaption,
  sleepingLine,
  smallTricksLine,
} from './eris';
import { DRAGON_STAGES, LIEUTENANT_ORDER } from './types';

const BANDS = ['none', 'strong', 'contested', 'weak', 'bois', 'argent', 'orichalque'] as const;

describe("Éris's dossier lines", () => {
  it('exist for every lieutenant × band and are distinct', () => {
    const all = LIEUTENANT_ORDER.flatMap((k) => BANDS.map((b) => dossierLine(k, b)));
    expect(all.every((s) => s.length > 20)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect(dossierLine('hydre', 'bois')).toBe('Mon Hydre porte un sceau. Ses têtes repoussent quand même, je les arrose tous les soirs.');
  });

  it('never target the player (Decision 19)', () => {
    for (const k of LIEUTENANT_ORDER) {
      for (const b of BANDS) {
        const line = dossierLine(k, b).toLowerCase();
        for (const w of FORBIDDEN) expect(line, `${k}/${b} contains "${w}"`).not.toContain(w);
      }
    }
  });

  it('bands follow the catch rate before the first seal, then the seal group (spec 2026-09-29 lieutenant levels §5)', () => {
    const l = (traps: number, rate: number | null, level = 0) => ({ level, all_time: { traps, caught: 0, missed: 0, rate } });
    expect(bandFor(l(2, 0))).toBe('none');
    expect(bandFor(l(5, 0.3))).toBe('strong');
    expect(bandFor(l(5, 0.5))).toBe('contested');
    expect(bandFor(l(5, 0.85))).toBe('weak');
    expect([1, 2, 3, 4, 5].map((lv) => bandFor(l(5, 0.1, lv)))).toEqual(['bois', 'bois', 'argent', 'argent', 'orichalque']);
  });

  it('knows who is awake at a class', () => {
    expect([isAwake('protee', '7H'), isAwake('protee', '8H'), isAwake('hydre', '5H')]).toEqual([false, true, true]);
  });

  // The line names whichever lieutenant sleeps, never a fixed one (review round 1 #1), and says
  // when it wakes in years, from the hero's class (UI3b playability #20: no « classe plus grande »).
  // Only Protée (min_level 8H) can be reached asleep through the running app today, so the other
  // genders are covered here at the unit level (the server says the same, test_world_api.py).
  it('says why a lieutenant sleeps and when it wakes, in the right number (Ruling B11)', () => {
    expect(sleepingLine('protee', '7H')).toBe('Protée dort encore. Il se réveillera dans un an.');
    expect(sleepingLine('protee', '6H')).toBe('Protée dort encore. Il se réveillera dans deux ans.');
    expect(sleepingLine('protee', '5H')).toBe('Protée dort encore. Il se réveillera dans trois ans.');
    expect(sleepingLine('protee')).toBe('Protée dort encore. Il se réveillera dans quelques années.');
    expect(sleepingLine('sirenes')).toBe('Les Sirènes dorment encore. Elles se réveilleront dans quelques années.');
    expect(sleepingLine('hydre')).toBe("L'Hydre dort encore. Elle se réveillera dans quelques années.");
    for (const k of LIEUTENANT_ORDER) expect(sleepingLine(k, '5H')).not.toMatch(/classe|école/);
    expect([sleepingCaption('protee'), sleepingCaption('sirenes')]).toEqual(['Dort encore', 'Dorment encore']);
  });

  it("speaks of her small tricks and of the file in words, never a trap count, and never at the player", () => {
    const lines = [smallTricksLine(0, 0), smallTricksLine(10, 1), smallTricksLine(10, 5), smallTricksLine(10, 9)];
    expect(new Set(lines).size).toBe(4);
    for (const line of lines) {
      expect(line).not.toMatch(/\d/);
      for (const w of FORBIDDEN) expect(line.toLowerCase()).not.toContain(w);
    }
    expect(dossierIntro('Ana', 1)).toBe('Dossier «\u202fAna\u202f». 1 texte surveillé de près. Voici où mes ruses passent encore.');
    expect(dossierIntro('Ana', 7)).toContain('7 textes surveillés');
  });

  it('names every lieutenant as the camp does', () => {
    expect(LIEUTENANT_ORDER.map(lieutenantName)).toEqual(["L'Hydre", 'Écho', 'La Chimère', 'Protée', 'Les Sirènes', 'Léthé']);
  });
});

describe('French gender agreement (I7)', () => {
  // Four of six lieutenants are feminine: l'Hydre, Écho, la Chimère and Léthé (a personification)
  // are 'f', les Sirènes are 'fp' (feminine plural); Protée alone is 'm'.
  it('matches the narrative gender of every lieutenant', () => {
    expect(genderFor('hydre')).toBe('f');
    expect(genderFor('echo')).toBe('f');
    expect(genderFor('chimere')).toBe('f');
    expect(genderFor('protee')).toBe('m');
    expect(genderFor('sirenes')).toBe('fp');
    expect(genderFor('lethe')).toBe('f');
  });

  it('agrees a participle/adjective with each gender', () => {
    expect(agree('Neutralisé', 'hydre')).toBe('Neutralisée');
    expect(agree('Neutralisé', 'protee')).toBe('Neutralisé');
    expect(agree('Neutralisé', 'sirenes')).toBe('Neutralisées');
  });

  // P1-1 (SP3 playability): the progression reveal's neutralisation card hard-coded "neutralisé"
  // ("L'Hydre — neutralisé !"), which is wrong for every feminine/plural lieutenant. It now builds
  // the line with `agree()`, lower-case base like the dossier/lieutenant page - covered directly
  // since battle/VictorySpoils.svelte has no component test in this codebase (pure functions only).
  it('agrees the reveal neutralisation line for every lieutenant', () => {
    expect(agree('neutralisé', 'hydre')).toBe('neutralisée');
    expect(agree('neutralisé', 'echo')).toBe('neutralisée');
    expect(agree('neutralisé', 'chimere')).toBe('neutralisée');
    expect(agree('neutralisé', 'lethe')).toBe('neutralisée');
    expect(agree('neutralisé', 'sirenes')).toBe('neutralisées');
    expect(agree('neutralisé', 'protee')).toBe('neutralisé');
  });

  it('picks the right stressed pronoun after "contre"', () => {
    expect(pronounFor('chimere')).toBe('elle');
    expect(pronounFor('protee')).toBe('lui');
    expect(pronounFor('sirenes')).toBe('elles');
  });

  it('agrees the picker confirm label, pronoun and verb together', () => {
    expect(confirmChoiceLabel('echo')).toBe("C'est celle-là");
    expect(confirmChoiceLabel('protee')).toBe("C'est celui-là");
    expect(confirmChoiceLabel('sirenes')).toBe('Ce sont celles-là');
  });

  it('covers every lieutenant, so a new one can\'t be added without a gender', () => {
    for (const key of LIEUTENANT_ORDER) expect(['f', 'm', 'fp']).toContain(genderFor(key));
  });
  it("keeps the hero's dragon to one dry aside, never a rank (spec 2026-09-29 dragon growth §2)", () => {
    expect(dragonAside('egg')).toBe("Ton dragon dort encore dans sa coquille. Qu'il y reste.");
    expect(dragonAside('illustre')).toBe("Ton dragon a grandi\u202f: dragon illustre. Je fais semblant de ne pas l'avoir vu.");
    for (const s of DRAGON_STAGES) expect(dragonAside(s)).not.toMatch(/rang/);
  });
});
