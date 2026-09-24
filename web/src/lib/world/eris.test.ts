import { describe, it, expect } from 'vitest';
import { FORBIDDEN, bandFor, dossierLine } from './eris';
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
});
