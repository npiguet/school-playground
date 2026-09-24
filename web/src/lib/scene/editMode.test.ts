import { describe, expect, it } from 'vitest';
import { isEditMode } from './editMode';

describe('isEditMode (Ruling 9)', () => {
  it('is on with ?edit before the hash or inside the hash query', () => {
    expect(isEditMode('?edit', {})).toBe(true);
    expect(isEditMode('?a=1&edit=1', {})).toBe(true);
    expect(isEditMode('', { edit: '' })).toBe(true);
  });
  it('is off otherwise', () => {
    expect(isEditMode('', {})).toBe(false);
    expect(isEditMode('?editor=1', { panel: 'heros' })).toBe(false);
  });
});
