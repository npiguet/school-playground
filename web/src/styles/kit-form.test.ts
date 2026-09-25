// UI3 Ruling A8 (scenes UI spec §2.4): real HTML forms restyled as parchment, bronze and marble.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../lib/ui/contrast';

const css = readFileSync('src/styles/kit-form.css', 'utf-8');
const tokens: Record<string, string> = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
);
const INK = '#2b2a28';
const PARCHMENT_SOLID = '#f3e6c8';

describe('in-world form kit', () => {
  it('restyles every legacy form control, but only inside .kit-form', () => {
    for (const sel of ['.kit-form input', '.kit-form select', '.kit-form textarea', '.kit-form label', '.kit-form .btn', '.kit-form .btn-primary', '.kit-form .btn-ghost', '.kit-form .card', '.kit-form .chip', '.kit-form .chip-active', '.kit-form table', '.kit-form h2', '.kit-form .muted']) {
      expect(css, sel).toContain(sel);
    }
    const bare = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((rule) => rule.split('{')[0].trim())
      .filter((sel) => sel && !sel.startsWith(':root'));
    // Split on top-level commas only: a `:is(a, b)` argument list is one selector, not several.
    const splitTopLevel = (sel: string) => {
      const parts: string[] = [];
      let depth = 0;
      let start = 0;
      for (let i = 0; i < sel.length; i++) {
        if (sel[i] === '(') depth++;
        else if (sel[i] === ')') depth--;
        else if (sel[i] === ',' && depth === 0) {
          parts.push(sel.slice(start, i));
          start = i + 1;
        }
      }
      parts.push(sel.slice(start));
      return parts;
    };
    for (const sel of bare) {
      for (const part of splitTopLevel(sel)) expect(part.trim().startsWith('.kit-form'), part).toBe(true);
    }
  });

  it('keeps text legible on the parchment fields', () => {
    expect(contrastRatio(INK, tokens['form-field'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(tokens['form-ink-soft'], tokens['form-field'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens['form-ink-soft'], PARCHMENT_SOLID)).toBeGreaterThanOrEqual(4.5);
  });

  it('never defines a red', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, name).toBe(false);
    }
  });

  it('is loaded after the legacy app.css so it wins the cascade', () => {
    const main = readFileSync('src/main.ts', 'utf-8');
    expect(main.indexOf("'./styles/kit-form.css'")).toBeGreaterThan(main.indexOf("'./app.css'"));
  });

  it('restyles a native select as a parchment field with a bronze chevron (playability #4)', () => {
    const rule = /\.kit-form select\s*\{[^}]*\}/g;
    const all = [...css.matchAll(rule)].map((m) => m[0]).join('\n');
    expect(all).toMatch(/appearance:\s*none/);
    expect(all).toMatch(/-webkit-appearance:\s*none/);
    expect(all).toMatch(/var\(--chevron\)/);
  });

  it('drops the hatch from chips (playability #9) and gives legends the label face (playability #3)', () => {
    const chip = /\.kit-form \.chip\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(chip).not.toMatch(/repeating-linear-gradient/);
    expect(css).toMatch(/\.kit-form label,\s*\n?\s*\.kit-form legend/);
  });

  it('keeps every control in an overlay a 48 px touch target (playability #25)', () => {
    expect(css).toMatch(/\.kit-form :is\(button, summary, a\.kit-bronze, a\.kit-link\)\s*\{[^}]*min-height:\s*48px/);
  });
});
