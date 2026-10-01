import { describe, expect, it } from 'vitest';
import { hudXp } from './hud';

// Spec 2026-09-29 dragon growth §2: one gauge, the dragon's, named by its stage.
describe('hudXp', () => {
  it('shows the way to the next stage, named by the stage', () => {
    expect(hudXp({ total: 3100, floor: 1200, next: 5000 }, 'young')).toEqual({ label: 'Jeune dragon · 3\u202f100 XP', value: 1900, max: 3800 });
    expect(hudXp({ total: 0, floor: 0, next: 100 }, 'egg')).toEqual({ label: 'Œuf · 0 XP', value: 0, max: 100 });
  });
  it('is full at the last stage and says « Dragon ancestral »', () => {
    expect(hudXp({ total: 41000, floor: 40000, next: null }, 'ancestral')).toEqual({ label: 'Dragon ancestral · 41\u202f000 XP', value: 1, max: 1 });
  });
  it('reads empty for a stage grown before its XP, full for a stale total past the next stage', () => {
    expect(hudXp({ total: 300, floor: 5000, next: 15000 }, 'adult')).toEqual({ label: 'Dragon adulte · 300 XP', value: 0, max: 10000 });
    expect(hudXp({ total: 1300, floor: 100, next: 1200 }, 'hatchling').value).toBe(1100);
  });
});
