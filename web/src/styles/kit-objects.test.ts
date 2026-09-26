// Immersion wave Task 3 (playability #1): the object kit the overlays are built from.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../lib/ui/contrast';

const css = readFileSync('src/styles/kit-objects.css', 'utf-8');

// Every hex token a `color`/`background` in this file can name through `var(--x)`: the app's own
// palette plus the kit's (fix round 1). Read from the sheets themselves, not retyped here, so a
// token edit in any of them is picked up automatically.
const TOKENS: Record<string, string> = Object.fromEntries(
  ['src/app.css', 'src/styles/kit.css', 'src/styles/kit-form.css', 'src/styles/kit-objects.css']
    .map((f) => readFileSync(f, 'utf-8'))
    .flatMap((sheet) => [...sheet.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)])
    .map((m) => [m[1], m[2].toLowerCase()]),
);

function resolveColor(literal: string): string {
  const v = literal.trim();
  const varMatch = /^var\(--([a-z0-9-]+)\)$/i.exec(v);
  if (varMatch) {
    const token = TOKENS[varMatch[1]];
    if (!token) throw new Error(`Unknown token --${varMatch[1]} (add it to TOKENS's sheets)`);
    return token;
  }
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (rgba) {
    const [r, g, b] = rgba[1].split(',').slice(0, 3).map((n) => Math.round(Number(n.trim())));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  throw new Error(`Unhandled colour literal: ${v}`);
}

/** Every colour a rule's `background`/`background-color` paints (gradient stops included, `var()`
 *  and `rgba()` resolved), or none for a token this file doesn't know how to read (e.g. `--grain`,
 *  a texture, not a colour). */
function backgroundColoursOf(ruleBody: string): string[] {
  const decl = /background(?:-color)?:\s*([^;]+);/.exec(ruleBody);
  if (!decl) throw new Error('no background declaration in rule');
  const out: string[] = [];
  for (const m of decl[1].matchAll(/#[0-9a-f]{6}|rgba?\([^)]+\)|var\(--[a-z0-9-]+\)/gi)) {
    try {
      out.push(resolveColor(m[0]));
    } catch {
      // A token this file doesn't carry a colour for (e.g. --grain's noise tile): not a surface
      // colour, skip it.
    }
  }
  if (out.length === 0) throw new Error(`no readable colour in background: ${decl[1]}`);
  return out;
}

function colorOf(ruleBody: string): string {
  const decl = /(?:^|[;{])\s*color:\s*([^;]+);/.exec(ruleBody);
  if (!decl) throw new Error('no color declaration in rule');
  return resolveColor(decl[1]);
}

/** The `{ ... }` body of the first rule whose selector is exactly `selector` (i.e. `selector` is
 *  immediately followed by `{`, not by a combinator, pseudo-class or another class), read from
 *  `sheet`. Finds the rule the way a browser would match `selector` alone, not a compound one it's
 *  part of (`.kit-medallion` vs `.kit-medallion.is-small`). */
function ruleBodyOf(sheet: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(sheet);
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[1];
}

/** The worst (lowest) contrast between `fg` and any colour `bg` paints. Fix round 2: checking only
 *  the darkest stop (round 1) missed that a *light* text colour is worst off against a gradient's
 *  *lightest* stop, not its darkest (`.kit-medallion`'s bronze-ink was ~9.6:1 on --bronze-dark but
 *  only ~2.5:1 on --bronze-light). Every stop is measured, so both directions are covered. */
function worstOf(fg: string, bg: string[]): number {
  return Math.min(...bg.map((b) => contrastRatio(fg, b)));
}

describe('object kit', () => {
  it('defines every object class the places use', () => {
    for (const cls of [
      'kit-seal', 'kit-tag', 'kit-tag-title', 'kit-tag-chapter', 'kit-tag-meta', 'kit-stamp', 'kit-prophecy', 'kit-cubby', 'kit-roll',
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

  // Fix round 1: .kit-stamp (aegean on the tag's darker stop, ~4.15:1) and .kit-tablet-stamp
  // (#3d4a1a straight on --clay-dark, ~1.8:1) were both below 4.5:1. Fix round 2: checking only the
  // darkest stop missed .kit-medallion's bronze-ink text failing against --bronze-light (~2.5:1,
  // the *lightest* stop) - every text-bearing object below is now checked against every colour the
  // surface it sits on paints (both directions), read out of the CSS itself (tokens resolved, not
  // retyped), so a future colour edit that regresses this fails here instead of in a screenshot
  // review.
  it('keeps every stamp, tag and note at least 4.5:1 on every colour the surface it sits on paints', () => {
    const tagBg = backgroundColoursOf(ruleBodyOf(css, '.kit-tag'));
    const goldBg = backgroundColoursOf(ruleBodyOf(css, '.kit-prophecy'));
    const cases: Array<[string, string, string[]]> = [
      ['.kit-stamp (on the tag)', colorOf(ruleBodyOf(css, '.kit-stamp')), tagBg],
      ['.kit-tag-meta (on the tag)', colorOf(ruleBodyOf(css, '.kit-tag-meta')), tagBg],
      ['.kit-tag-chapter (on the tag)', colorOf(ruleBodyOf(css, '.kit-tag-chapter')), tagBg],
      [
        '.kit-tablet-stamp (on its own backing)',
        colorOf(ruleBodyOf(css, '.kit-tablet-stamp')),
        backgroundColoursOf(ruleBodyOf(css, '.kit-tablet-stamp')),
      ],
      ['.kit-note (olive tone)', colorOf(ruleBodyOf(css, '.kit-note')), backgroundColoursOf(ruleBodyOf(css, '.kit-note'))],
      [
        "kit-note[data-tone='eris']",
        colorOf(ruleBodyOf(css, '.kit-note')), // the tone variant only overrides the border and background
        backgroundColoursOf(ruleBodyOf(css, ".kit-note[data-tone='eris']")),
      ],
      ['.kit-prophecy (on the gold ribbon)', colorOf(ruleBodyOf(css, '.kit-prophecy')), goldBg],
      ['.kit-tablet-ribbon (on the gold ribbon)', colorOf(ruleBodyOf(css, '.kit-tablet-ribbon')), goldBg],
      ['.kit-ribbon (on its cloth gradient)', colorOf(ruleBodyOf(css, '.kit-ribbon')), backgroundColoursOf(ruleBodyOf(css, '.kit-ribbon'))],
      [
        '.kit-medallion (on its bronze gradient)',
        colorOf(ruleBodyOf(css, '.kit-medallion')),
        backgroundColoursOf(ruleBodyOf(css, '.kit-medallion')),
      ],
      [
        '.kit-bronze.is-quiet',
        colorOf(ruleBodyOf(css, '.kit-bronze.is-quiet')),
        backgroundColoursOf(ruleBodyOf(css, '.kit-bronze.is-quiet')),
      ],
    ];
    for (const [name, fg, bg] of cases) {
      expect(worstOf(fg, bg), `${name}: ${fg} on ${bg.join(', ')}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // UI3b lane W fix round 1: an empty gauge track (rgba 0.18 on parchment) was nearly invisible.
  // Its rim is a graphic, so 3:1 (WCAG 1.4.11) against every colour of the sheet it sits on.
  it("draws the gauge track's rim at least 3:1 on the parchment sheet", () => {
    const rim = /border:\s*1px solid ([^;]+);/.exec(ruleBodyOf(css, '.kit-gauge-track'));
    expect(rim, '.kit-gauge-track has a 1px rim').not.toBeNull();
    const sheetBg = backgroundColoursOf(ruleBodyOf(css, '.kit-sheet'));
    expect(worstOf(resolveColor(rim![1]), sheetBg)).toBeGreaterThanOrEqual(3);
  });
});
