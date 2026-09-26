// UI5 Ruling E17: the camp's sounds are the catalogue's, AAC in .m4a, within budget, each with its
// length known and its CC0 source credited.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import META from './meta.gen.json';
import { LOOP_MAX_S, LOOP_MIN_S, MUSIC_BUDGET_BYTES, SFX, SFX_BUDGET_BYTES, SFX_MAX_BYTES, TRACKS, TRACK_MAX_BYTES } from './catalog';

const file = (src: string) => `public${src}`;
const size = (src: string) => statSync(file(src)).size;

describe('the audio files (spec §7)', () => {
  it('ships every catalogued sound as an MP4/AAC file, and nothing else', () => {
    for (const d of [...Object.values(TRACKS), ...Object.values(SFX)]) {
      expect(existsSync(file(d.src)), d.src).toBe(true);
      expect(readFileSync(file(d.src)).subarray(4, 8).toString('latin1'), d.src).toBe('ftyp');
    }
    const shipped = ['music', 'sfx'].flatMap((k) => readdirSync(`public/audio/${k}`).map((f) => `/audio/${k}/${f}`)).sort();
    expect(shipped).toEqual([...Object.values(TRACKS), ...Object.values(SFX)].map((d) => d.src).sort());
  });

  it('keeps the music within 8 MiB (each loop within 2 MiB) and the effects small', () => {
    const music = Object.values(TRACKS).map((d) => size(d.src));
    for (const [i, d] of Object.values(TRACKS).entries()) expect(music[i], d.src).toBeLessThanOrEqual(TRACK_MAX_BYTES);
    expect(music.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MUSIC_BUDGET_BYTES);
    const fx = Object.values(SFX).map((d) => size(d.src));
    for (const [i, d] of Object.values(SFX).entries()) expect(fx[i], d.src).toBeLessThanOrEqual(SFX_MAX_BYTES);
    expect(fx.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(SFX_BUDGET_BYTES);
  });

  it("knows each loop's exact length, between 30 and 90 s", () => {
    const meta = META as Record<string, { samples: number; rate: number; priming: number }>;
    expect(Object.keys(meta).sort()).toEqual(Object.keys(TRACKS).sort());
    for (const [id, m] of Object.entries(meta)) {
      expect(m.rate, id).toBe(44100);
      expect(m.priming, id).toBe(1024);
      expect(m.samples / m.rate, id).toBeGreaterThanOrEqual(LOOP_MIN_S);
      expect(m.samples / m.rate, id).toBeLessThanOrEqual(LOOP_MAX_S);
    }
  });

  it('credits every file with its CC0 source (ASSETS-LICENSES.md, tools/audio/sources.json)', () => {
    const credits = readFileSync('../ASSETS-LICENSES.md', 'utf-8');
    const sources = JSON.parse(readFileSync('../tools/audio/sources.json', 'utf-8')) as Record<string, Record<string, string>>;
    for (const d of [...Object.values(TRACKS), ...Object.values(SFX)]) {
      expect(credits, d.src).toContain(`web/public${d.src}`);
      const s = sources[d.src.replace('/audio/', '').replace('.m4a', '')];
      expect(s, d.src).toBeDefined();
      expect(s.license, d.src).toBe('CC0 1.0');
      for (const k of ['url', 'author', 'title', 'evidence', 'sha256']) expect(s[k], `${d.src} ${k}`).toBeTruthy();
    }
    expect(credits).not.toMatch(/Audio credits \(scenes UI spec §7\) are added\s+in UI5/);
  });
});
