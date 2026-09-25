import { describe, it, expect } from 'vitest';
import { FORBIDDEN, agree, bandFor, confirmChoiceLabel, dossierLine, genderFor, lockedLine, pronounFor } from './eris';
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

  // Dossier.svelte's locked-row caption used to hardcode "Protée" (the only lieutenant that can
  // actually be locked today, since every other one's min_level is the game's own floor, 5H) -
  // this proves the line is parameterised by name, for any lieutenant, not just Protée
  // (review round 1 #1). No other lieutenant can be reached locked through the running app
  // (Ruling: level 5H, the lowest playable level, already unlocks all but Protée), so this is
  // covered at the unit level instead of e2e.
  it('names whichever lieutenant is actually locked, not a fixed one', () => {
    expect(lockedLine('Protée')).toBe('Protée dort encore. Son heure viendra.');
    expect(lockedLine("L'Hydre")).toBe("L'Hydre dort encore. Son heure viendra.");
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
