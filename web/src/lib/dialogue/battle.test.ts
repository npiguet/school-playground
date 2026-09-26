import { beforeEach, describe, expect, it } from 'vitest';
import { erisVictoryKey, erisVictoryLine, musterLine } from './battle';
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
    expect(erisVictoryLine({ draft: 4, catchRate: 0.5, introduced: 2, mode: 'dictation' }).text).toMatch(/\(Et j'en ai glissé 2 pendant ta relecture\. Sournois, je sais\.\)$/);
  });

  it('opens the muster with her line, her retry line, or the lieutenant’s dossier line', () => {
    expect(musterLine({ opponent: 'eris', band: null, mode: 'grimoire', retry: false }).key).toBe('battle.start');
    expect(musterLine({ opponent: 'eris', band: null, mode: 'dictation', retry: true }).key).toBe('battle.retry');
    const lt = musterLine({ opponent: 'hydre', band: 'strong', mode: 'dictation', retry: false });
    expect(lt.key).toBeUndefined();
    expect(lt.text).toContain('Hydre');
  });
});
