import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HELP_STAGES, defenceMeta, helpStageLine, localDay, rateText } from './journal';

describe("the journal's words (UI3 Ruling B6; the register guard's « niveau » carry)", () => {
  it('says what the Muses do at each of the four stages, with no school word', () => {
    expect(HELP_STAGES).toEqual([1, 2, 3, 4]);
    expect(HELP_STAGES.map(helpStageLine)).toEqual([
      "Les yeux d'Argus éclairent chaque piège.",
      'Les Muses nomment les passes, sans les éclairer.',
      'Les Muses annoncent seulement le nombre de pièges.',
      'Les Muses te laissent relire sans aide.',
    ]);
    expect(helpStageLine(9)).toBe('');
    for (const s of HELP_STAGES) expect(helpStageLine(s)).not.toMatch(/niveau|classe|école/i);
  });
});

describe('a defence in the journal (fix round 1)', () => {
  // The hero's clock: Zurich is UTC+2 in September, so 22:30 UTC is already the next day at home.
  let tz: string | undefined;
  beforeEach(() => {
    tz = process.env.TZ;
    process.env.TZ = 'Europe/Zurich';
  });
  afterEach(() => {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  });
  const today = new Date(2026, 8, 26);

  it('dates a text finished at 00:30 local time on that local day, not the UTC one', () => {
    expect(localDay('2026-09-21T22:30:00+00:00')).toBe('2026-09-22');
    expect(defenceMeta({ finished_at: '2026-09-21T22:30:00+00:00', score: 10, catch_rate: 0.75 }, today)).toBe('mardi 22 septembre · 10 points · 75 % déjoués');
  });

  it('leaves the rate out when there was nothing to catch, with a real plural for the points', () => {
    expect(defenceMeta({ finished_at: '2026-09-22T12:00:00+00:00', score: 1, catch_rate: null }, today)).toBe('mardi 22 septembre · 1 point');
    expect(rateText(null)).toBe('—');
    expect(rateText(0.5)).toBe('50 %');
  });
});
