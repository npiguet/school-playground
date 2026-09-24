import { describe, expect, it } from 'vitest';
import { isDebugMode } from './debugMode';

describe('isDebugMode (Ruling 9 revised - Task 9b)', () => {
  it('is on with ?debug before the hash or inside the hash query', () => {
    expect(isDebugMode('?debug', {})).toBe(true);
    expect(isDebugMode('?a=1&debug=1', {})).toBe(true);
    expect(isDebugMode('', { debug: '' })).toBe(true);
  });
  it('is off otherwise', () => {
    expect(isDebugMode('', {})).toBe(false);
    expect(isDebugMode('?debugger=1', { panel: 'heros' })).toBe(false);
  });
});
