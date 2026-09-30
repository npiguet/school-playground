import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN,
  agree,
  bandFor,
  confirmChoiceLabel,
  dossierIntro,
  dossierLine,
  erisProgressLine,
  genderFor,
  neutraliseRule,
  lieutenantName,
  pronounFor,
  sleepingCaption,
  sleepingLine,
  smallTricksLine,
} from './eris';
import { LIEUTENANT_ORDER } from './types';

const BANDS = ['none', 'strong', 'contested', 'weak', 'neutralised'] as const;

describe("Éris's dossier lines", () => {
  it('exist for every lieutenant × band and are distinct', () => {
    const all = LIEUTENANT_ORDER.flatMap((k) => BANDS.map((b) => dossierLine(k, b)));
    expect(all.every((s) => s.length > 20)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it('never target the player (Decision 19)', () => {
    for (const k of LIEUTENANT_ORDER) {
      for (const b of BANDS) {
        const line = dossierLine(k, b).toLowerCase();
        for (const w of FORBIDDEN) expect(line, `${k}/${b} contains "${w}"`).not.toContain(w);
      }
    }
  });

  it('bands follow the thresholds', () => {
    const l = (traps: number, rate: number | null, neutralised = false) =>
      ({ neutralised, all_time: { traps, caught: 0, missed: 0, rate } }) as never;
    expect(bandFor(l(2, 0))).toBe('none');
    expect(bandFor(l(5, 0.3))).toBe('strong');
    expect(bandFor(l(5, 0.5))).toBe('contested');
    expect(bandFor(l(5, 0.85))).toBe('weak');
    expect(bandFor(l(5, 0.1, true))).toBe('neutralised');
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

  // UI3b playability #3, #12: Éris's file says what stands between the hero and a lieutenant in one
  // sentence (no « 3/3 jours · 12/10 pièges · 92 % »), and the portrait says the rule once.
  it('says in one sentence what is left before a lieutenant falls', () => {
    const l = (days: number, traps: number, rate: number | null, allTraps = traps, neutralised = false) =>
      ({ neutralised, all_time: { traps: allTraps, caught: 0, missed: 0, rate }, window: { days, traps, rate } }) as never;
    expect(erisProgressLine('hydre', l(2, 6, 0.8))).toBe("Encore 1 jour de garde et 4 pièges à croiser avant qu'elle tombe.");
    expect(erisProgressLine('protee', l(3, 4, 0.9))).toBe("Encore 6 pièges à croiser avant qu'il tombe.");
    expect(erisProgressLine('sirenes', l(0, 0, null, 3))).toBe("Encore 3 jours de garde et 10 pièges à croiser avant qu'elles tombent.");
    expect(erisProgressLine('echo', l(3, 12, 0.7))).toBe("Il ne te reste qu'à déjouer 8 pièges sur 10 avant qu'elle tombe.");
    expect(erisProgressLine('chimere', l(0, 0, null, 0))).toBe('Pas encore croisée.');
    expect(erisProgressLine('sirenes', l(0, 0, null, 0))).toBe('Pas encore croisées.');
    expect(erisProgressLine('hydre', l(3, 12, 0.9, 16, true))).toBe('');
    expect(neutraliseRule('hydre')).toBe('Pour la neutraliser\u202f: 3 jours de garde, 10 pièges croisés, et 8 sur 10 déjoués.');
    expect(neutraliseRule('protee')).toMatch(/^Pour le neutraliser/);
    expect(neutraliseRule('sirenes')).toMatch(/^Pour les neutraliser/);
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
});
