import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from './contrast';

describe('contrastRatio (WCAG 2.x)', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#8a5a28', '#8a5a28')).toBeCloseTo(1, 5);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#2b2a28', '#f3e6c8')).toBeCloseTo(contrastRatio('#f3e6c8', '#2b2a28'), 10);
  });
  it('rejects anything but #rrggbb', () => {
    expect(() => luminance('red')).toThrow();
    expect(() => luminance('#fff')).toThrow();
  });
});
