import { describe, expect, it } from 'vitest';
import { hotspotSelector, hotspotTestId } from './hotspotId';

describe('hotspot test ids (UI1 Ruling 4, final review M18)', () => {
  it('names a hotspot `<sceneId>-<id>` and selects it by that test id', () => {
    expect(hotspotTestId('library', 'shelves')).toBe('library-shelves');
    expect(hotspotSelector('delphi', 'pythia')).toBe('[data-testid="delphi-pythia"]');
  });
});
