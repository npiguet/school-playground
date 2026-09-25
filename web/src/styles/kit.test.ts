// Scenes UI spec §6: parchment panels, bronze buttons, marble plaques, laurel bar - CSS first.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

  it('stacks overlays through tokens, all below the rotate screen (final review M7)', () => {
    const z = (name: string) => Number(new RegExp(`--${name}:\\s*(\\d+)`).exec(css)?.[1]);
    expect(z('z-overlay-backdrop')).toBeLessThan(z('z-overlay'));
    expect(z('z-overlay')).toBeLessThan(z('z-rotate-screen'));
  });

  it('names the immersion-wave surfaces and keeps text legible on them (Ruling W1, playability #8)', () => {
    for (const t of ['wood', 'wood-dark', 'reward-ink', 'wax', 'wax-dark', 'clay', 'clay-dark']) expect(tokens[t], t).toBeDefined();
    const GOLD_LIGHT = '#f1dc9a'; // app.css --gold-light
    expect(contrastRatio(tokens['bronze-ink'], tokens['wood-dark'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(GOLD_LIGHT, tokens['wood-dark'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(tokens['reward-ink'], tokens['parchment-solid'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(INK, tokens['clay'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens['bronze-ink'], tokens['wax-dark'])).toBeGreaterThanOrEqual(4.5);
  });

  it("gives Éris's orange a legible ink on parchment, used kit-wide (fix round 1 ruling W-c)", () => {
    expect(contrastRatio(tokens['orange-ink'], tokens['parchment-solid'])).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(/\.kit-form \.orange,\s*\.kit-parchment \.orange\s*\{\s*color:\s*var\(--orange-ink\)/);
  });

  it('drops the HUD band on a stage without a HUD (fix round 1 #7)', () => {
    expect(css).toMatch(/:root:not\(:has\(\.scene-stage\.has-hud\)\)\s*\{\s*--hud-band:/);
  });

  it('reserves the HUD band for the HUD (Ruling W11)', () => {
    expect(css).toMatch(/--hud-band:\s*calc\(72px \+ env\(safe-area-inset-top\)\)/);
  });

  it('points every art url of the kit stylesheets at a shipped file (Ruling W3)', () => {
    for (const f of readdirSync('src/styles').filter((n) => n.endsWith('.css'))) {
      const text = readFileSync(`src/styles/${f}`, 'utf-8');
      for (const m of text.matchAll(/url\(\s*['"]?(\/art\/[^'")]+)['"]?\s*\)/g)) {
        expect(existsSync('public' + m[1]), `${f}: ${m[1]}`).toBe(true);
      }
    }
  });

  it('declares the idle and tap keyframes the scene components use', () => {
    for (const k of ['kit-glow', 'kit-glow-strong', 'kit-label-bob', 'kit-flash', 'kit-sway', 'kit-breathe']) {
      expect(css).toContain(`@keyframes ${k}`);
    }
  });
});
