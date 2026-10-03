// The baked tints (amended 2026-10-03, the user: "for production, we'll use the baked tints"): every
// dragon stage under every tint but the bronze is a picture of its own, baked offline by
// tools/art/bake_tints.py, and the game shows those files (art.ts dragonArt). This file keeps them
// there, fresh and right:
// - fresh: the manifest's hash of each file is sha256 of its tint's settings line and its source
//   sprite's bytes, recomputed here from TINT_SPECS and the sprite on disk; a changed tint or a re-cut
//   sprite fails with the command to run;
// - right: the manifest carries pixels sampled on flat ground (the source's and the baked file's own,
//   as libwebp decodes them; the file's sha256 ties them to its bytes), and the TypeScript reference,
//   tintOklch, must give the baked colours within WebP tolerance. A negative control proves the
//   tolerance tells a tinted file from the bronze. The bake's --check compares every opaque pixel with
//   the numpy port (tools/art/tints.py).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DRAGON_STAGES, type Tint } from './types';
import { TINT_SPECS } from './dragon';
import { ART, dragonArt } from './art';
import { tintOklch, type OklchSpec } from '../living/tint';
import { webpSize } from '../../testing/webp';
import MANIFEST from './bakedTints.json' with { type: 'json' };

const REBAKE = `re-bake: ${MANIFEST.command}`;
const TINTED = (Object.entries(TINT_SPECS) as [Tint, OklchSpec | null][]).filter((e): e is [Tint, OklchSpec] => e[1] !== null);
const FILES = MANIFEST.files as Record<string, { source: string; tint: string; hash: string; sha256: string; samples: number[][] }>;

// The bake's settings line (bake_tints.py spec_line): numbers as JavaScript writes them, as Python's fmt.
const specLine = (s: OklchSpec) => `oklch-v1 shift ${s.shift} chroma ${s.chroma} lightness ${s.lightness}\n`;
const sha256 = (...parts: (string | Buffer)[]) => {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
};
const read = (p: string) => readFileSync('public' + p);

/** Per sample, the largest channel error of `spec` (null: none) on the base colour against the baked one. */
function errors(samples: number[][], spec: OklchSpec | null): number[] {
  return samples.map(([, , r, g, b, R, G, B]) => {
    const want = spec ? tintOklch([r / 255, g / 255, b / 255], spec.shift, spec.chroma, spec.lightness).map((c) => Math.round(c * 255)) : [r, g, b];
    return Math.max(Math.abs(want[0] - R), Math.abs(want[1] - G), Math.abs(want[2] - B));
  });
}
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
// Measured 2026-10-03 on the 30 files' 48 samples: at most 8 on a channel, a file's mean 1.90 to 2.96.
const SAMPLE_MAX = 10;
const SAMPLE_MEAN_MAX = 3.5;

describe('the baked tints', () => {
  it('dragonArt gives the sprite for the bronze and the baked picture for a tint', () => {
    for (const s of DRAGON_STAGES) {
      expect(dragonArt(s, 'bronze')).toBe(ART.dragon[s]);
      expect(dragonArt(s, null)).toBe(ART.dragon[s]);
      for (const [t] of TINTED) expect(dragonArt(s, t)).toBe(`/art/dragon/dragon_${s}_${t}.webp`);
    }
  });

  it('every stage x tint is there, the sprite\'s size, and the manifest lists exactly them', () => {
    const want: string[] = [];
    for (const s of DRAGON_STAGES) {
      for (const [t] of TINTED) {
        const p = dragonArt(s, t);
        want.push(p.slice('/art/dragon/'.length));
        expect(existsSync('public' + p), `${p} missing; ${REBAKE}`).toBe(true);
        expect(webpSize('public' + p), p).toEqual(webpSize('public' + ART.dragon[s]));
      }
    }
    expect(Object.keys(FILES).sort()).toEqual([...want].sort());
    // Nothing else baked lies about (a tint gone from TINT_SPECS leaves no orphan file shipped).
    const onDisk = readdirSync('public/art/dragon').filter((f) => f.endsWith('.webp') && !f.endsWith('_cut.webp'));
    expect(onDisk.sort()).toEqual([...want].sort());
  });

  it('is fresh: each file was baked from the current TINT_SPECS and sprite, and is the file the manifest saw', () => {
    for (const s of DRAGON_STAGES) {
      const source = read(ART.dragon[s]);
      for (const [t, spec] of TINTED) {
        const name = `dragon_${s}_${t}.webp`;
        const entry = FILES[name];
        expect(entry, `${name} not in the manifest; ${REBAKE}`).toBeDefined();
        expect(entry.source).toBe(`dragon_${s}_cut.webp`);
        expect(entry.tint).toBe(t);
        expect(entry.hash, `${name} is stale (its tint or sprite changed); ${REBAKE}`).toBe(sha256(specLine(spec), source));
        expect(entry.sha256, `${name} changed since the bake; ${REBAKE}`).toBe(sha256(read(dragonArt(s, t))));
      }
    }
  });

  it('the settings line is the bake\'s own, number for number', () => {
    expect(specLine({ shift: -166, chroma: 0.52, lightness: 1.36 })).toBe('oklch-v1 shift -166 chroma 0.52 lightness 1.36\n');
    expect(specLine({ shift: 165, chroma: 0.9, lightness: 1 })).toBe('oklch-v1 shift 165 chroma 0.9 lightness 1\n');
    expect(readFileSync('../tools/art/bake_tints.py', 'utf-8')).toContain('return f"oklch-v1 shift {fmt(shift)} chroma {fmt(chroma)} lightness {fmt(lightness)}\\n"');
  });

  it('its pixels are the CPU reference tintOklch of the sprite\'s, within WebP tolerance', () => {
    for (const [name, entry] of Object.entries(FILES)) {
      const spec = TINT_SPECS[entry.tint as Tint];
      expect(entry.samples.length, name).toBe(48);
      const err = errors(entry.samples, spec);
      expect(Math.max(...err), name).toBeLessThanOrEqual(SAMPLE_MAX);
      expect(mean(err), name).toBeLessThanOrEqual(SAMPLE_MEAN_MAX);
      // Negative control: the same samples read as the untinted bronze are far off the tolerance.
      expect(mean(errors(entry.samples, null)), `${name} against the bronze`).toBeGreaterThan(4 * SAMPLE_MEAN_MAX);
    }
  });
});
