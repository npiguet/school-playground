// Scenes UI spec §6: parchment panels, bronze buttons, marble plaques, laurel bar - CSS first.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../lib/ui/contrast';

const css = readFileSync('src/styles/kit.css', 'utf-8');
const tokens: Record<string, string> = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
);
const INK = '#2b2a28';

describe('UI kit (scenes spec §6)', () => {
  it('defines the kit classes', () => {
    for (const cls of ['kit-parchment', 'kit-scroll', 'kit-bronze', 'kit-plaque', 'kit-banner', 'sr-only', 'idle-bob', 'idle-sway', 'idle-breathe']) {
      expect(css, cls).toMatch(new RegExp(`\\.${cls}\\s*\\{`));
    }
  });

  it('keeps text legible on its own surfaces', () => {
    expect(contrastRatio(INK, tokens['parchment-solid'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(tokens['bronze-ink'], tokens['bronze'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens['bronze-ink'], tokens['night'])).toBeGreaterThanOrEqual(7);
  });

  it('never defines a red (orange is for Éris, red for nobody)', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, name).toBe(false);
    }
  });

  it('declares the idle and tap keyframes the scene components use', () => {
    for (const k of ['kit-glow', 'kit-label-bob', 'kit-flash', 'kit-sway', 'kit-breathe']) {
      expect(css).toContain(`@keyframes ${k}`);
    }
  });
});
