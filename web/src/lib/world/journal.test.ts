import { describe, expect, it } from 'vitest';
import { HELP_STAGES, helpStageLine } from './journal';

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
