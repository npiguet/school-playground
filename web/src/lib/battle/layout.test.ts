import { describe, expect, it } from 'vitest';
import { COMPACT_MAX_PX, bandHeight, battleLayout } from './layout';

describe('the compact battle (Ruling C4)', () => {
  it('folds when the keyboard takes the bottom of the screen', () => {
    expect(battleLayout(820, 820)).toBe('full'); // iPad landscape, no keyboard
    expect(battleLayout(765, 820)).toBe('full'); // a hardware keyboard's shortcut bar
    expect(battleLayout(420, 820)).toBe('compact'); // the on-screen keyboard
    expect(battleLayout(720, 720)).toBe('full'); // the desktop project
  });

  it('folds on a short window too (spec §10: a reduced viewport height)', () => {
    expect(battleLayout(480, 480)).toBe('compact');
    expect(battleLayout(COMPACT_MAX_PX, COMPACT_MAX_PX)).toBe('full');
  });

  it('keeps the band between 64 and 104 px', () => {
    expect(bandHeight(420)).toBe(84);
    expect(bandHeight(250)).toBe(64);
    expect(bandHeight(700)).toBe(104);
  });
});
