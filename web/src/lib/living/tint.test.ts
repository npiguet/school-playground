// The living dragon's tint (spec 2026-10-02 living dragon, "Tint"): TINT_FILTERS stay the single source;
// their CSS functions become the Filter Effects colour matrices the fragment shader applies. The
// browser's own CSS filter is the reference for the pixels: living-dragon.spec.ts compares the canvas
// with the still picture under the same tint.
import { describe, expect, it } from 'vitest';
import { TINT_FILTERS, TINT_STRENGTH } from '../world/dragon';
import {
  IDENTITY,
  applyTint,
  cssSpecMatrices,
  filterMatrices,
  filterStep,
  hsvToRgb,
  oklchToRgb,
  parseFilter,
  presetSpec,
  rgbToHsv,
  rgbToOklch,
  tintHsv,
  tintOklch,
  tintPixel,
  tintText,
  type Mat3,
  type Rgb,
} from './tint';

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

// The lab's tint methods (user, 2026-10-02: "can we try working in the HSV color space, and maybe try
// rotating the H channel?"): HSV and OKLCH next to the CSS matrices, each pixel's hue turned by a
// shift. These CPU references mirror the fragment shader's modes 1 and 2.
const SAMPLES: Rgb[] = [];
for (const r of [0, 0.2, 0.45, 0.7, 1]) for (const g of [0, 0.3, 0.55, 0.9]) for (const b of [0, 0.15, 0.6, 1]) SAMPLES.push([r, g, b]);
const BRONZE: Rgb = [184 / 255, 134 / 255, 59 / 255];
SAMPLES.push(BRONZE, [0.5, 0.5, 0.5]);
const inUnit = (c: Rgb) => c.every((v) => v >= -1e-9 && v <= 1 + 1e-9);

describe('HSV and OKLCH tints', () => {
  it('round-trips every sample through HSV and OKLCH within 1/255', () => {
    for (const c of SAMPLES) {
      close(hsvToRgb(rgbToHsv(c)), c, 1 / 255);
      close(oklchToRgb(rgbToOklch(c)), c, 1 / 255);
    }
  });

  it('leaves every colour as it is at shift 0, sat 1, val 1, and after a whole turn', () => {
    for (const c of SAMPLES) {
      for (const shift of [0, 360, -360]) {
        close(tintHsv(c, shift, 1, 1), c, 1 / 255);
        close(tintOklch(c, shift, 1, 1), c, 1 / 255);
      }
    }
  });

  it('keeps V and S on an HSV hue shift', () => {
    for (const c of SAMPLES) {
      const [, s, v] = rgbToHsv(c);
      for (const shift of [25, 90, 190, -120]) {
        const [, s2, v2] = rgbToHsv(tintHsv(c, shift, 1, 1));
        expect(Math.abs(v2 - v)).toBeLessThan(1e-9);
        expect(Math.abs(s2 - s)).toBeLessThan(1e-9);
      }
    }
  });

  it('turns the HSV hue by the shift, scales S and V, and clamps', () => {
    const [h, s, v] = rgbToHsv(BRONZE);
    const [h2, s2, v2] = rgbToHsv(tintHsv(BRONZE, 120, 0.5, 1.2));
    expect(Math.abs(h2 - ((h + 120 / 360) % 1))).toBeLessThan(1e-9);
    expect(Math.abs(s2 - s * 0.5)).toBeLessThan(1e-9);
    expect(Math.abs(v2 - v * 1.2)).toBeLessThan(1e-9);
    close(tintHsv([1, 0.5, 0], 0, 3, 2), [1, 0.5, 0], 1e-9); // S and V already at 1: clamped
  });

  it('keeps OKLCH lightness on a hue shift (exactly while in gamut; the gamut clip only lowers chroma)', () => {
    let inGamut = 0;
    for (const c of SAMPLES) {
      const [L, C, h] = rgbToOklch(c);
      for (const shift of [25, 90, 190, -120]) {
        const raw = oklchToRgb([L, C, h + shift]);
        const out = tintOklch(c, shift, 1, 1);
        expect(inUnit(out)).toBe(true);
        const [L2, C2] = rgbToOklch(out);
        if (inUnit(raw)) {
          inGamut++;
          expect(Math.abs(L2 - L), `${c} ${shift}`).toBeLessThan(1e-6);
          expect(Math.abs(C2 - C), `${c} ${shift}`).toBeLessThan(1e-6);
        } else {
          expect(Math.abs(L2 - L), `${c} ${shift}`).toBeLessThan(2e-3);
          expect(C2).toBeLessThanOrEqual(C + 1e-6);
        }
      }
    }
    expect(inGamut).toBeGreaterThan(40);
  });

  it('scales OKLCH chroma and lightness, a grey staying grey', () => {
    const [L, C] = rgbToOklch(BRONZE);
    const [L2, C2] = rgbToOklch(tintOklch(BRONZE, 0, 0.5, 1.1));
    expect(Math.abs(L2 - L * 1.1)).toBeLessThan(1e-6);
    expect(Math.abs(C2 - C * 0.5)).toBeLessThan(1e-6);
    close(tintOklch([0.5, 0.5, 0.5], 150, 1.5, 1), [0.5, 0.5, 0.5], 1e-6);
  });

  it('mixes each method with the original by the strength', () => {
    for (const mode of ['css', 'hsv', 'oklch'] as const) {
      const spec = { mode, shift: 150, sat: 0.9, val: 1.1, strength: 1 };
      const full = tintPixel(spec, BRONZE);
      close(tintPixel({ ...spec, strength: 0 }, BRONZE), BRONZE, 1e-12);
      close(tintPixel({ ...spec, strength: 0.7 }, BRONZE), full.map((v, i) => 0.7 * v + 0.3 * BRONZE[i]), 1e-12);
    }
    close(tintPixel({ mode: 'hsv', shift: 30, sat: 1, val: 1, strength: 1 }, BRONZE), tintHsv(BRONZE, 30, 1, 1), 1e-12);
    close(tintPixel({ mode: 'oklch', shift: 30, sat: 1, val: 1, strength: 1 }, BRONZE), tintOklch(BRONZE, 30, 1, 1), 1e-12);
  });

  it("gives the CSS method the game's own matrices for every tint preset", () => {
    for (const [tint, css] of Object.entries(TINT_FILTERS)) {
      const spec = presetSpec(css, 'css');
      expect(spec.strength, tint).toBe(TINT_STRENGTH);
      for (const c of SAMPLES) close(tintPixel(spec, c), applyTint(filterMatrices(css), c, TINT_STRENGTH), 1e-9);
    }
    expect(cssSpecMatrices({ mode: 'css', shift: 0, sat: 1, val: 1, strength: 1 })).toEqual([IDENTITY, IDENTITY]);
  });

  it('starts HSV and OKLCH at the hue the CSS tint gives the bronze, keeping its saturate and brightness', () => {
    for (const mode of ['hsv', 'oklch'] as const) {
      const toH = mode === 'hsv' ? (c: Rgb) => rgbToHsv(c)[0] * 360 : (c: Rgb) => rgbToOklch(c)[2];
      for (const tint of ['ecume', 'olivier', 'braise', 'jade'] as const) {
        const spec = presetSpec(TINT_FILTERS[tint], mode);
        expect(Number.isInteger(spec.shift)).toBe(true);
        expect(spec.shift).toBeGreaterThanOrEqual(-180);
        expect(spec.shift).toBeLessThanOrEqual(180);
        const want = toH(applyTint(filterMatrices(TINT_FILTERS[tint]), BRONZE));
        const got = toH(tintPixel({ ...spec, sat: 1, val: 1, strength: 1 }, BRONZE));
        const d = Math.abs(((((got - want) % 360) + 540) % 360) - 180);
        expect(d, `${mode} ${tint}`).toBeLessThan(1);
      }
      expect(presetSpec(TINT_FILTERS.ecume, mode)).toMatchObject({ sat: 0.9, val: 1, strength: TINT_STRENGTH });
      expect(presetSpec(TINT_FILTERS.argent, mode)).toMatchObject({ shift: 0, sat: 0, val: 1.15 });
      expect(presetSpec('none', mode)).toEqual({ mode, shift: 0, sat: 1, val: 1, strength: TINT_STRENGTH });
    }
  });

  it('writes a copyable line per method', () => {
    expect(tintText('ecume', { mode: 'oklch', shift: 150, sat: 0.9, val: 1, strength: 0.7 })).toBe('ecume: oklch shift 150 sat 0.90 val 1.00 strength 0.70');
    expect(tintText('jade', { mode: 'css', shift: 120, sat: 0.9, val: 1, strength: 0.7 })).toBe(
      'jade: css shift 120 sat 0.90 val 1.00 strength 0.70 (hue-rotate(120deg) saturate(0.9))',
    );
    expect(tintText('bronze', { mode: 'css', shift: 0, sat: 1, val: 1, strength: 0.7 })).toBe('bronze: css shift 0 sat 1.00 val 1.00 strength 0.70 (none)');
  });
});
