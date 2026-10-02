// The still pictures' tint (stillTint.ts): the same OKLCH steps as the CPU reference on each straight
// pixel, transparent ones untouched, one render per picture and tint.
import { describe, expect, it, vi } from 'vitest';
import { TINT_SPECS } from '../world/dragon';
import { createStillTints, tintPixels } from './stillTint';
import { tintOklch, type OklchSpec } from './tint';

const PIXELS = [
  [184, 134, 59, 255],
  [136, 65, 41, 255],
  [114, 69, 41, 128],
  [255, 255, 255, 3],
  [12, 200, 90, 0],
  [0, 0, 0, 255],
  [184, 134, 59, 255],
];

describe('tintPixels', () => {
  it('tints each pixel as the CPU reference does, keeps the alpha, and skips transparent ones', () => {
    for (const [tint, spec] of Object.entries(TINT_SPECS)) {
      if (!spec) continue;
      const data = new Uint8ClampedArray(PIXELS.flat());
      tintPixels(data, spec);
      PIXELS.forEach(([r, g, b, a], p) => {
        const got = [...data.slice(p * 4, p * 4 + 4)];
        if (a === 0) return expect(got, `${tint} ${p}`).toEqual([r, g, b, a]);
        const want = tintOklch([r / 255, g / 255, b / 255], spec.shift, spec.chroma, spec.lightness).map((v) => Math.round(v * 255));
        expect(got, `${tint} ${p}`).toEqual([...want, a]);
      });
    }
  });

  it('tints only the pixels asked for, a range at a time, with a shared memo', () => {
    const spec = TINT_SPECS.ecume!;
    const whole = new Uint8ClampedArray(PIXELS.flat());
    tintPixels(whole, spec);
    const parts = new Uint8ClampedArray(PIXELS.flat());
    const memo = new Map<number, number>();
    tintPixels(parts, spec, memo, 0, 3);
    expect([...parts.slice(12)]).toEqual(PIXELS.slice(3).flat());
    tintPixels(parts, spec, memo, 3, PIXELS.length);
    expect(parts).toEqual(whole);
    expect(memo.size).toBe(5); // the bronze twice, the transparent pixel never
  });
});

describe('createStillTints', () => {
  const SPEC: OklchSpec = { shift: 165, chroma: 0.9, lightness: 1 };

  it('makes a picture once per tint, however many ask while it is made, and answers at once after', async () => {
    let finish: (url: string) => void = () => {};
    const render = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    const tints = createStillTints(render);
    expect(tints.peek('/a.webp', SPEC)).toBeNull();
    const [one, two] = [tints.get('/a.webp', SPEC), tints.get('/a.webp', { ...SPEC })];
    expect(render).toHaveBeenCalledTimes(1);
    finish('blob:a-ecume');
    expect(await one).toBe('blob:a-ecume');
    expect(await two).toBe('blob:a-ecume');
    expect(tints.peek('/a.webp', SPEC)).toBe('blob:a-ecume');
    expect(await tints.get('/a.webp', SPEC)).toBe('blob:a-ecume');
    expect(render).toHaveBeenCalledTimes(1);
    void tints.get('/a.webp', { ...SPEC, shift: 50 });
    void tints.get('/b.webp', SPEC);
    expect(render).toHaveBeenCalledTimes(3);
  });

  it('gives an untinted picture as it is, and never tries a failed one again in the session', async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error('no canvas')).mockResolvedValue('blob:b');
    const tints = createStillTints(render);
    expect(tints.peek('/a.webp', null)).toBe('/a.webp');
    expect(await tints.get('/a.webp', null)).toBe('/a.webp');
    await expect(tints.get('/a.webp', SPEC)).rejects.toThrow('no canvas');
    expect(tints.peek('/a.webp', SPEC)).toBeNull();
    await expect(tints.get('/a.webp', SPEC)).rejects.toThrow('no canvas');
    expect(render).toHaveBeenCalledTimes(1);
    expect(await tints.get('/b.webp', SPEC)).toBe('blob:b');
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('keys a tint on its exact numbers, not on a rounded line', async () => {
    const render = vi.fn((src: string, spec: OklchSpec) => Promise.resolve(`blob:${src}:${spec.chroma}`));
    const tints = createStillTints(render);
    expect(await tints.get('/a.webp', { ...SPEC, chroma: 0.901 })).toBe('blob:/a.webp:0.901');
    expect(await tints.get('/a.webp', { ...SPEC, chroma: 0.904 })).toBe('blob:/a.webp:0.904');
    expect(render).toHaveBeenCalledTimes(2);
  });
});
