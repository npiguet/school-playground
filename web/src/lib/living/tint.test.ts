// The living dragon's tint (spec 2026-10-02 living dragon, "Tint"): TINT_FILTERS stay the single source;
// their CSS functions become the Filter Effects colour matrices the fragment shader applies. The
// browser's own CSS filter is the reference for the pixels: living-dragon.spec.ts compares the canvas
// with the still picture under the same tint.
import { describe, expect, it } from 'vitest';
import { TINT_FILTERS, TINT_STRENGTH } from '../world/dragon';
import { IDENTITY, applyTint, filterMatrices, filterStep, parseFilter, type Mat3 } from './tint';

const close = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.forEach((v, i) => expect(Math.abs(v - b[i]), `index ${i}`).toBeLessThan(eps));
const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

describe('tint matrices', () => {
  it('reads « none » as no tint at all', () => {
    expect(filterMatrices('none')).toEqual([IDENTITY, IDENTITY]);
  });

  it('expresses every dragon tint in at most two steps', () => {
    for (const [tint, css] of Object.entries(TINT_FILTERS)) expect(() => filterMatrices(css), tint).not.toThrow();
  });

  it('keeps the neutral steps neutral', () => {
    close(filterStep('saturate', 1), IDENTITY);
    close(filterStep('hue-rotate', 0), IDENTITY);
    close(filterStep('hue-rotate', 360), IDENTITY);
    close(filterStep('brightness', 1), IDENTITY);
  });

  it('uses the Filter Effects coefficients (hue-rotate(180deg) as the spec writes it)', () => {
    close(filterStep('hue-rotate', 180), [-0.574, 1.43, 0.144, 0.426, 0.43, 0.144, 0.426, 1.43, -0.856], 1e-12);
    close(filterStep('saturate', 0), [0.213, 0.715, 0.072, 0.213, 0.715, 0.072, 0.213, 0.715, 0.072], 1e-12);
  });

  it('hands the shader column-major matrices', () => {
    const [a] = filterMatrices('hue-rotate(90deg)');
    close(a, transpose(filterStep('hue-rotate', 90)));
  });

  it('keeps a grey grey under a hue rotation or a desaturation (rows sum to one)', () => {
    for (const css of [TINT_FILTERS.ecume, TINT_FILTERS.olivier, TINT_FILTERS.jade, TINT_FILTERS.braise]) {
      close(applyTint(filterMatrices(css), [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5], 1e-9);
    }
  });

  it('turns the bronze swatch to a lighter grey under argent, clamping as CSS does', () => {
    // #b8863b: luminance 0.213 R + 0.715 G + 0.072 B = 0.546078, times 1.15.
    close(applyTint(filterMatrices(TINT_FILTERS.argent), [184 / 255, 134 / 255, 59 / 255]), [0.62799, 0.62799, 0.62799], 1e-4);
    close(applyTint(filterMatrices('brightness(3)'), [0.5, 0.2, 0.9]), [1, 0.6, 1], 1e-9);
  });

  it('softens the tint by mixing the tinted colour with the original', () => {
    const sample = [184 / 255, 134 / 255, 59 / 255] as const;
    expect(TINT_STRENGTH).toBe(0.7);
    for (const css of Object.values(TINT_FILTERS)) {
      const m = filterMatrices(css);
      const full = applyTint(m, sample);
      close(applyTint(m, sample, 0.7), full.map((v, i) => 0.7 * v + 0.3 * sample[i]), 1e-9);
      close(applyTint(m, sample, 0), sample);
      close(applyTint(m, sample, 1), full);
      close(applyTint(m, sample), full);
    }
  });

  it('reads percentages as fractions', () => {
    expect(parseFilter('saturate(90%)')).toEqual([{ fn: 'saturate', value: 0.9 }]);
    expect(parseFilter(' hue-rotate(-25deg)  saturate(1.3) ')).toEqual([
      { fn: 'hue-rotate', value: -25 },
      { fn: 'saturate', value: 1.3 },
    ]);
  });

  it('refuses what the shader cannot do (the dragon then keeps its still picture)', () => {
    for (const css of ['blur(2px)', 'grayscale(1)', 'hue-rotate(10rad)', 'hue-rotate(10deg) saturate(1) brightness(1)', 'saturate(', 'saturate(1) junk']) {
      expect(() => filterMatrices(css), css).toThrow();
    }
  });
});
