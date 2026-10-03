// The dragon's tint (user, 2026-10-02: the OKLCH tints at full strength): the CPU reference of the
// baked pictures (tools/art/bake_tints.py, held to it by world/bakedTints.test.ts, amended
// 2026-10-03) and of the lab's shader preview.
import { describe, expect, it } from 'vitest';
import { oklchToRgb, rgbToOklch, tintOklch, tintPixel, tintText, type Rgb } from './tint';

const close = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.forEach((v, i) => expect(Math.abs(v - b[i]), `index ${i}`).toBeLessThan(eps));

const SAMPLES: Rgb[] = [];
for (const r of [0, 0.2, 0.45, 0.7, 1]) for (const g of [0, 0.3, 0.55, 0.9]) for (const b of [0, 0.15, 0.6, 1]) SAMPLES.push([r, g, b]);
const BRONZE: Rgb = [184 / 255, 134 / 255, 59 / 255];
SAMPLES.push(BRONZE, [0.5, 0.5, 0.5]);
const inUnit = (c: Rgb) => c.every((v) => v >= -1e-9 && v <= 1 + 1e-9);

describe('the OKLCH tint', () => {
  it('round-trips every sample through OKLCH within 1/255', () => {
    for (const c of SAMPLES) close(oklchToRgb(rgbToOklch(c)), c, 1 / 255);
  });

  it('leaves every colour as it is at shift 0, chroma 1, lightness 1, and after a whole turn', () => {
    for (const c of SAMPLES) {
      for (const shift of [0, 360, -360]) close(tintOklch(c, shift, 1, 1), c, 1 / 255);
    }
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

  it('leaves the bronze (no tint) as it is and tints the others with tintOklch', () => {
    for (const c of SAMPLES) expect(tintPixel(null, c)).toEqual([...c]);
    expect(tintPixel({ shift: 30, chroma: 0.8, lightness: 1.1 }, BRONZE)).toEqual(tintOklch(BRONZE, 30, 0.8, 1.1));
  });

  it('writes a copyable line', () => {
    expect(tintText('ecume', { shift: 165, chroma: 0.9, lightness: 1 })).toBe('ecume: oklch shift 165 chroma 0.90 lightness 1.00');
    expect(tintText('bronze', null)).toBe('bronze: none');
  });
});
