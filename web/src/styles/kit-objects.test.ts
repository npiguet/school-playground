// Immersion wave Task 3 (playability #1): the object kit the overlays are built from.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/kit-objects.css', 'utf-8');

describe('object kit', () => {
  it('defines every object class the places use', () => {
    for (const cls of [
      'kit-seal', 'kit-tag', 'kit-tag-title', 'kit-tag-meta', 'kit-stamp', 'kit-prophecy', 'kit-cubby', 'kit-roll',
      'roll-css', 'kit-sheet', 'kit-tablet', 'kit-medallion', 'kit-ribbon', 'kit-link', 'kit-note', 'kit-gauge',
    ]) {
      expect(css, cls).toMatch(new RegExp(`\\.${cls}[\\s,.:{\\[]`));
    }
    expect(css).toMatch(/\.kit-seal\.is-broken/);
    expect(css).toMatch(/\.kit-bronze\.is-quiet/);
    expect(css).toMatch(/\.kit-bronze:disabled/);
  });

  it('draws no hatching and no red (playability #9, spec ethics)', () => {
    expect(css).not.toMatch(/repeating-linear-gradient\(\s*115deg/);
    for (const m of css.matchAll(/#([0-9a-f]{6})\b/gi)) {
      const n = parseInt(m[1], 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, m[0]).toBe(false);
    }
  });

  it('honours reduced motion for its own animations', () => {
    if (/@keyframes/.test(css)) expect(css).toMatch(/prefers-reduced-motion/);
  });

  it('is loaded after the form kit, so its label-based classes win the cascade', () => {
    const main = readFileSync('src/main.ts', 'utf-8');
    expect(main.indexOf("'./styles/kit-objects.css'")).toBeGreaterThan(main.indexOf("'./styles/kit-form.css'"));
  });
});
