import { beforeEach, describe, expect, it } from 'vitest';
import { erisVictoryKey, erisVictoryLine, musterLine, stillStanding } from './battle';
import type { Category, ErrorSub, TokenError } from '../grading/types';
import { LINES } from './content';
import { poolFor, resetDialogueMemory } from './select';
import { frenchSpacing } from '../text/french';

beforeEach(() => resetDialogueMemory());

describe("Éris in battle (Ruling E14)", () => {
  it('reacts to the reckoning, never live', () => {
    expect(erisVictoryKey({ draft: 0, catchRate: null })).toBe('battle.perfect');
    expect(erisVictoryKey({ draft: 5, catchRate: 0.8 })).toBe('battle.victory');
    expect(erisVictoryKey({ draft: 5, catchRate: 0.6 })).toBe('battle.retreat');
    expect(erisVictoryKey({ draft: 5, catchRate: 0.2 })).toBe('battle.caught');
    expect(erisVictoryKey({ draft: 5, catchRate: 0 })).toBe('battle.missed');
    expect(erisVictoryKey({ draft: 5, catchRate: null })).toBe('battle.missed');
  });

  it('speaks a grimoire line in a grimoire, and adds her aside for the traps she slipped in', () => {
    const g = erisVictoryLine({ draft: 4, catchRate: 1, introduced: 0, mode: 'grimoire' });
    expect(poolFor(LINES['battle.victory'], { mode: 'grimoire' }).map((x) => frenchSpacing(x.text))).toContain(g.text);
    expect(g).toMatchObject({ speaker: 'eris', key: 'battle.victory' });
    expect(erisVictoryLine({ draft: 4, catchRate: 0.5, introduced: 2, mode: 'dictation' }).text).toMatch(/\(Et j'en ai glissé 2 pendant ta relecture\. Sournoise, je sais\.\)$/);
  });

  it('opens the muster with her line, her retry line, or the lieutenant’s dossier line', () => {
    expect(musterLine({ opponent: 'eris', band: null, mode: 'grimoire', retry: false }).key).toBe('battle.start');
    expect(musterLine({ opponent: 'eris', band: null, mode: 'dictation', retry: true }).key).toBe('battle.retry');
    const lt = musterLine({ opponent: 'hydre', band: 'strong', mode: 'dictation', retry: false });
    expect(lt.key).toBeUndefined();
    expect(lt.text).toContain('Hydre');
  });
});

describe('the traps the dragon explains (Ruling E14)', () => {
  // A trap still standing in the final text (result.finalErrors, the words « Revoir » marks orange).
  const e = (refIndex: number | null, category: Category, sub?: ErrorSub, anchor = refIndex ?? -1): TokenError => ({
    refIndex,
    typedIndex: refIndex,
    expected: refIndex === null ? null : `m${refIndex}`,
    typed: 'x',
    category,
    sub,
    anchor,
  });

  it('takes the traps still standing, in text order, one per category, at most two', () => {
    const final = [e(9, 'agreement', 'verb'), e(2, 'homophone'), e(4, 'agreement', 'verb'), e(6, 'accent')];
    expect(stillStanding(final, 2).map((x) => x.refIndex)).toEqual([2, 4]);
    expect(stillStanding(final, 3).map((x) => x.refIndex)).toEqual([2, 4, 6]);
    // An agreement's kind is its own category (the « Revoir » groups): verb and participle both count.
    expect(stillStanding([e(3, 'agreement', 'participle'), e(1, 'agreement', 'verb')], 2).map((x) => x.refIndex)).toEqual([1, 3]);
    // A word in excess has no reference index: it sits right after its anchor.
    expect(stillStanding([e(5, 'accent'), e(null, 'lexical', 'extra', 4)], 2).map((x) => x.category)).toEqual(['lexical', 'accent']);
    expect(stillStanding([], 2)).toEqual([]);
  });
});
