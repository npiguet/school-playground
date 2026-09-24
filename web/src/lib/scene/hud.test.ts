import { describe, expect, it } from 'vitest';
import { hudXp } from './hud';

describe('hudXp', () => {
  it('shows progress inside the current rank', () => {
    expect(hudXp({ total: 220, rank: 2, title: 'Écuyère du camp', next_threshold: 400, rank_floor: 150 })).toEqual({
      label: 'Écuyère du camp · 220 XP',
      value: 70,
      max: 250,
    });
  });
  it('shows a full laurel at the last rank', () => {
    expect(hudXp({ total: 9000, rank: 10, title: 'Légende', next_threshold: null, rank_floor: 8000 })).toEqual({
      label: 'Légende · 9000 XP',
      value: 1,
      max: 1,
    });
  });
});
