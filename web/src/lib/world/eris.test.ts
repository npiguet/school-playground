import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN,
  agree,
  bandFor,
  confirmChoiceLabel,
  dossierLine,
  genderFor,
  lieutenantName,
  pronounFor,
  sleepingCaption,
  sleepingLine,
  stirringCaption,
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
  // it wakes with a bigger class. Only Protée (min_level 8H) can be reached asleep through the
  // running app today, so the plural is covered here at the unit level.
  it('says why a lieutenant sleeps and when it wakes, in the right number (Ruling B11)', () => {
    expect(sleepingLine('protee')).toBe('Protée dort encore. Ses ruses viendront dans une classe plus grande.');
    expect(sleepingLine('sirenes')).toBe('Les Sirènes dorment encore. Leurs ruses viendront dans une classe plus grande.');
    expect([sleepingCaption('protee'), sleepingCaption('sirenes')]).toEqual(['Dort encore', 'Dorment encore']);
    expect([stirringCaption('echo'), stirringCaption('sirenes')]).toEqual(["S'agite", "S'agitent"]);
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
  // since ProgressionReveal.svelte has no component test in this codebase (pure functions only).
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
