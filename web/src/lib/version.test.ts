import { describe, it, expect } from 'vitest';
import { buildLine } from './version';

describe('buildLine (the lyre credits’ last line, from GET /api/health)', () => {
  it('names the commit and the day the image was built', () => {
    expect(buildLine({ commit: 'b68ecc8', date: '2026-09-29' })).toBe('version b68ecc8 · 29 septembre 2026');
    expect(buildLine({ commit: 'b68ecc8', date: '2026-10-01' })).toBe('version b68ecc8 · 1er octobre 2026');
  });

  it('leaves out a day it does not know', () => {
    expect(buildLine({ commit: 'b68ecc8', date: 'unknown' })).toBe('version b68ecc8');
    expect(buildLine({ commit: 'b68ecc8', date: '2026-02-30' })).toBe('version b68ecc8');
  });

  it('says so when the image was built without a stamp', () => {
    expect(buildLine({ commit: 'unknown', date: 'unknown' })).toBe('version inconnue');
    expect(buildLine({ commit: 'unknown', date: '2026-09-29' })).toBe('version inconnue · 29 septembre 2026');
  });

  it('shows nothing when the server gave no stamp', () => {
    expect(buildLine(undefined)).toBeNull();
    expect(buildLine(null)).toBeNull();
  });
});
