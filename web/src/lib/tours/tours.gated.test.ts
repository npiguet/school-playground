// Spec 2026-09-29 explanations §2 (R9): a new step meant for one stage only leaves the other stages
// with nothing to re-show, so PlaceScene marks the tour seen silently. Today's content has no such
// step (content.test keeps every stage served), so a fixture stands in for it.
import { describe, expect, it, vi } from 'vitest';
import { tourSteps, tourVersion } from './tours';

// Hoisted above the import by vitest.
vi.mock('../dialogue/content', async (importOriginal) => {
  const real = await importOriginal<typeof import('../dialogue/content')>();
  return {
    ...real,
    TOURS: {
      ...real.TOURS,
      library: [
        { speaker: 'owl', target: null, text: 'Bienvenue.' },
        { speaker: 'owl', target: null, since: 2, when: { stage: ['adult'] }, text: 'Un mot pour les grands dragons.' },
      ],
    },
  };
});

describe('a stage-gated new step (R9)', () => {
  it('re-shows nothing for a stage it does not serve, and the step for the one it does', () => {
    expect(tourVersion('library')).toBe(2);
    expect(tourSteps('library', { name: 'Brasier', stage: 'young', tint: 'olive' } as never, 1).lines).toEqual([]);
    expect(tourSteps('library', { name: 'Brasier', stage: 'adult', tint: 'olive' } as never, 1).lines.map((l) => l.text)).toEqual(['Un mot pour les grands dragons.']);
  });
});
