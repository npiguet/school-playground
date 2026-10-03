import { describe, it, expect } from 'vitest';
import { DRAGON_STAGES, type Progression } from './types';
import {
  DEFAULT_STAGE_XP,
  LOCKED_EGG_FILTER,
  TINT_SPECS,
  TINT_SWATCH,
  dragonCaption,
  gaugeOf,
  nearNextStage,
  nextStage,
  scaleOf,
  stageActivity,
  stageLabel,
  stageLine,
  stageXp,
  validName,
  victoryGauge,
  victoryLaurel,
} from './dragon';
import { rgbToOklch, tintPixel, type Rgb } from '../living/tint';

describe('dragon helpers', () => {
  it('knows when the next stage is close: strictly under a fifth of the span (spec 2026-09-29 explanations §1, R4)', () => {
    expect(nearNextStage({ total: 1101, floor: 100, next: 1200 })).toBe(true);
    expect(nearNextStage({ total: 980, floor: 100, next: 1200 })).toBe(false); // exactly a fifth left
    expect(nearNextStage({ total: 81, floor: 0, next: 100 })).toBe(true);
    expect(nearNextStage({ total: 300, floor: 5000, next: 15000 })).toBe(false); // a stage grown before its XP
    expect(nearNextStage({ total: 41000, floor: 40000, next: null })).toBe(false);
  });
  it("has six tints, the user's OKLCH settings of 2026-10-02 at full strength", () => {
    expect(Object.keys(TINT_SPECS)).toEqual(['bronze', 'ecume', 'olivier', 'braise', 'jade', 'argent']);
    expect(TINT_SPECS).toEqual({
      bronze: null,
      ecume: { shift: 165, chroma: 0.9, lightness: 1 },
      olivier: { shift: 50, chroma: 0.8, lightness: 1 },
      braise: { shift: -33, chroma: 1.3, lightness: 1 },
      jade: { shift: 101, chroma: 0.9, lightness: 1 },
      argent: { shift: -166, chroma: 0.52, lightness: 1.36 },
    });
  });
  it("never tints the dragon violet (reserved for Éris, decision 11)", () => {
    // On the CPU reference: the baked pictures the game shows are held equal to it (bakedTints.test.ts).
    // Éris's band is 260-329 degrees on the colour wheel (HSV hue). In OKLCH, the hue of a tinted
    // colour, it runs from the OKLCH hue of the wheel's 260 degrees to that of its 329 (full
    // saturation), across 0: about 280 to 1.3 degrees. Éris's own violet (--violet) falls in it.
    const wheel = (deg: number): Rgb => {
      const f = (n: number) => 1 - Math.max(0, Math.min((n + deg / 60) % 6, 4 - ((n + deg / 60) % 6), 1));
      return [f(5), f(3), f(1)];
    };
    const [from, to] = [rgbToOklch(wheel(260))[2], rgbToOklch(wheel(329))[2]];
    expect(from).toBeCloseTo(279.9, 1);
    expect(to).toBeCloseTo(1.3, 1);
    const violet = (h: number) => h >= from || h <= to;
    const hex = (s: string): Rgb => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) as unknown as Rgb;
    expect(violet(rgbToOklch(hex('#5b2c83'))[2])).toBe(true);
    // An OKLCH colour with a chroma under 0.04 reads as a grey, not as violet (ruling L10): it is
    // under a third of Éris's own violet's chroma (0.142) and under the bronze dragon's median
    // chroma (0.043-0.063 by stage), so its hue is a faint cast on a grey, not a colour of its own.
    const FLOOR = 0.04;
    expect(rgbToOklch(hex('#5b2c83'))[1]).toBeGreaterThan(3 * FLOOR);
    // The bronze swatch, then each stage's dragon as the cut pictures paint it: the pixel colour at the
    // 1st, 10th, 50th, 90th and 99th percentile of their OKLCH hue (opaque pixels of chroma over
    // 0.03), from the red shadows to the blue-green highlights of the upper tail.
    const DRAGON: Record<string, string[]> = {
      swatch: ['#b8863b'],
      egg: ['#522a1c', '#724529', '#937447', '#555734', '#20394b'],
      hatchling: ['#73372c', '#6b3a24', '#876336', '#7a6c38', '#496560'],
      young: ['#5d2d23', '#7c3f1f', '#765b34', '#75643a', '#3f5c64'],
      adult: ['#62332e', '#884129', '#6a492b', '#8e7a54', '#4c6779'],
      illustre: ['#472a25', '#6a3722', '#715030', '#c4b27f', '#4e573a'],
      ancestral: ['#48231f', '#54271a', '#654727', '#87704a', '#2d4863'],
    };
    // Accepted by the user (2026-10-02): a few dark shadows/highlights at the band's edge; the body
    // colour never turns violet ("I like the tints as is"). The user's own presets turn these
    // sampled colours (the hue tails, never the body's bronze) into Éris's band at a chroma above the
    // floor. Braise turns the darkest red shadows (1st percentile) to a wine red at OKLCH 354-360
    // (HSV 333-338, past the wheel's 329 only at full saturation); jade, olivier and écume turn the
    // blue-green highlights (99th percentile) to a mauve or a dusky lavender. Their values are not
    // changed here: the list must stay exactly this, so a new violet colour, or one gone, fails.
    const KNOWN = [
      'braise #73372c',
      'braise #5d2d23',
      'braise #62332e',
      'braise #472a25',
      'braise #48231f',
      'jade #20394b',
      'jade #2d4863',
      'ecume #4e573a',
      'olivier #2d4863',
    ];
    const found: string[] = [];
    for (const [tint, spec] of Object.entries(TINT_SPECS)) {
      for (const c of Object.values(DRAGON).flat()) {
        const [, C, h] = rgbToOklch(tintPixel(spec, hex(c)));
        if (C >= FLOOR && violet(h)) found.push(`${tint} ${c}`);
      }
    }
    expect(found.sort()).toEqual([...KNOWN].sort());
    // The body's bronze (the swatch and each stage's median) never turns violet, whatever the chroma.
    for (const [tint, spec] of Object.entries(TINT_SPECS)) {
      for (const c of [DRAGON.swatch[0], ...Object.values(DRAGON).slice(1).map((cs) => cs[2])]) {
        const h = rgbToOklch(tintPixel(spec, hex(c)))[2];
        expect(violet(h), `${tint} on ${c}: OKLCH hue ${h.toFixed(1)}`).toBe(false);
      }
    }
  });
  it('labels and lines', () => {
    expect(stageLabel('egg')).toBe('Œuf');
    expect(stageLabel('adult')).toBe('Dragon adulte');
    expect(DRAGON_STAGES.map(stageLabel)).toEqual(['Œuf', 'Dragonnet', 'Jeune dragon', 'Dragon adulte', 'Dragon illustre', 'Dragon ancestral']);
    expect(dragonCaption({ name: null, stage: 'ancestral' })).toBe('Dragon ancestral');
    expect(dragonCaption({ name: null, stage: 'egg' })).toBe('Un œuf de dragon');
    expect(dragonCaption({ name: null, stage: 'young' })).toBe('Jeune dragon');
    expect(dragonCaption({ name: 'Braise', stage: 'young' })).toBe('Braise');
    const xp = (total: number, floor: number, next: number | null) => ({ total, floor, next });
    // UI3b playability #15: the dragon speaks in the first person under its own plate.
    expect(stageLine('egg', xp(40, 0, 100))).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    // Spec 2026-09-29 dragon growth §3: how far the next stage is, in words; « under 20 % » is strict.
    expect(stageLine('hatchling', xp(150, 100, 1200))).toBe('Chaque texte bien défendu me fait grandir.');
    expect(stageLine('young', xp(4240, 1200, 5000))).toBe('Chaque texte bien défendu me fait grandir.'); // 760 of 3800 left: 20 %
    expect(stageLine('young', xp(4241, 1200, 5000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('illustre', xp(39000, 15000, 40000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('adult', xp(300, 5000, 15000))).toBe('Chaque texte bien défendu me fait grandir.'); // grown before its XP
    expect(stageLine('ancestral', xp(41000, 40000, null))).toBe("J'ai tout lu, tout vu. Et je veille toujours sur toi.");
    // Explanations §1, R7: the camp can ask for the far wording (its next goal already says « Encore un peu »).
    expect(stageLine('young', xp(4241, 1200, 5000), false)).toBe('Chaque texte bien défendu me fait grandir.');
    expect(stageLine('egg', xp(90, 0, 100), true)).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    for (const st of DRAGON_STAGES) {
      expect(stageLine(st, xp(4300, 1200, 5000))).not.toMatch(/\d|Braise|Ton dragon|ruse|neutralis|technique/);
    }
  });
  it('measures the gauge on a stage scale, clamped, full at the top', () => {
    expect(gaugeOf(3100, { floor: 1200, next: 5000 })).toEqual({ value: 1900, max: 3800 });
    expect(gaugeOf(300, { floor: 5000, next: 15000 })).toEqual({ value: 0, max: 10000 });
    expect(gaugeOf(9000, { floor: 100, next: 1200 })).toEqual({ value: 1100, max: 1100 });
    expect(gaugeOf(41000, { floor: 40000, next: null })).toEqual({ value: 1, max: 1 });
    expect(DRAGON_STAGES.map(nextStage)).toEqual(['hatchling', 'young', 'adult', 'illustre', 'ancestral', 'ancestral']);
  });
  it('says what it is up to as a sentence, never a lone word (UI3b playability #5)', () => {
    expect(stageActivity('egg')).toBe('Il frémit dans sa coquille.');
    expect(stageActivity('hatchling')).toBe('Il est curieux.');
    expect(stageActivity('young')).toBe("Il s'entraîne à voler.");
    expect(stageActivity('adult')).toBe('Il monte la garde.');
    expect(stageActivity('illustre')).toBe('Il veille sur le camp et raconte ses exploits.');
    expect(stageActivity('ancestral')).toBe('Il lit les vieux parchemins et veille sur toi.');
  });
  it('greys a locked egg (fix round 1: on the egg picture only)', () => {
    expect(LOCKED_EGG_FILTER).toMatch(/grayscale\(1\)/);
  });
  it('validates names', () => {
    expect(validName('  Braise ')).toBe(true);
    expect(validName('')).toBe(false);
    expect(validName('a'.repeat(21))).toBe(false);
    expect(validName('a\nb')).toBe(false);
  });
  it('has a flat swatch per tint, never a red (UI3 Ruling A12)', () => {
    expect(Object.keys(TINT_SWATCH).sort()).toEqual(['argent', 'braise', 'bronze', 'ecume', 'jade', 'olivier']);
    for (const [tint, hex] of Object.entries(TINT_SWATCH)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, tint).toBe(false);
    }
  });
});

describe('the victory gauge (spec 2026-09-29 dragon growth §2)', () => {
  const T = DEFAULT_STAGE_XP;
  const p = (xp: Partial<Progression['xp']>, dragon: Progression['dragon']) => ({
    xp: { session: 51, bonuses: [], total_before: 0, total_after: 0, ...xp },
    dragon,
  });
  const stay = (s: Progression['dragon']['stage_after']) => ({ stage_before: s, stage_after: s, needs_name: false });

  it('reads the stage table from the catalogue, the defaults until it has come', () => {
    expect(DEFAULT_STAGE_XP).toEqual({ egg: 0, hatchling: 100, young: 1200, adult: 5000, illustre: 15000, ancestral: 40000 });
    expect(stageXp(null)).toEqual(T);
    expect(stageXp({ stages: [{ key: 'hatchling', xp: 50 }, { key: 'dragon', xp: 7 }] })).toEqual({ ...T, hatchling: 50 });
    expect(scaleOf('young', T)).toEqual({ floor: 1200, next: 5000 });
    expect(scaleOf('ancestral', T)).toEqual({ floor: 40000, next: null });
  });

  it('stays on one scale when the dragon does not grow', () => {
    const g = victoryGauge(p({ total_before: 487, total_after: 538, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 }, stay('hatchling')), T);
    expect(g).toEqual({ stages: { before: 'hatchling', after: 'hatchling' }, grew: false, before: { label: 'Dragonnet', max: 1100, from: 387 }, after: { label: 'Dragonnet', max: 1100, from: 387, to: 438 } });
  });

  it('fills the old stage, then switches to the new one', () => {
    const g = victoryGauge(p({ total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 }, { stage_before: 'hatchling', stage_after: 'young', needs_name: false }), T);
    expect(g).toEqual({ stages: { before: 'hatchling', after: 'young' }, grew: true, before: { label: 'Dragonnet', max: 1100, from: 1000 }, after: { label: 'Jeune dragon', max: 3800, from: 0, to: 11 } });
  });

  it('skips a middle stage when it crosses two at once', () => {
    const g = victoryGauge(p({ total_before: 60, total_after: 1250, stage_before: 'egg', stage_after: 'young', floor: 1200, next: 5000 }, { stage_before: 'egg', stage_after: 'young', needs_name: true }), T);
    expect(g).toEqual({ stages: { before: 'egg', after: 'young' }, grew: true, before: { label: 'Œuf', max: 100, from: 60 }, after: { label: 'Jeune dragon', max: 3800, from: 0, to: 50 } });
  });

  it('is full at the top, never dividing by zero', () => {
    const g = victoryGauge(p({ total_before: 39950, total_after: 40100, stage_before: 'illustre', stage_after: 'ancestral', floor: 40000, next: null }, { stage_before: 'illustre', stage_after: 'ancestral', needs_name: false }), T);
    expect(g).toEqual({ stages: { before: 'illustre', after: 'ancestral' }, grew: true, before: { label: 'Dragon illustre', max: 25000, from: 24950 }, after: { label: 'Dragon ancestral', max: 1, from: 1, to: 1 } });
  });

  it('reads empty for a stage grown before its XP', () => {
    const g = victoryGauge(p({ total_before: 300, total_after: 354, stage_before: 'adult', stage_after: 'adult', floor: 5000, next: 15000 }, stay('adult')), T);
    expect(g.after).toEqual({ label: 'Dragon adulte', max: 10000, from: 0, to: 0 });
  });

  it('resumes a victory saved before the stages on the dragon\'s scale', () => {
    // A play state saved before the change: rank fields, no stage fields (R7).
    const legacy = { xp: { session: 51, bonuses: [], total_before: 60, total_after: 160, rank_before: 1, rank_after: 2, title_after: 'Scribe des Muses' }, dragon: { stage_before: 'egg' as const, stage_after: 'hatchling' as const, needs_name: true } };
    expect(victoryGauge(legacy, T)).toEqual({ stages: { before: 'egg', after: 'hatchling' }, grew: true, before: { label: 'Œuf', max: 100, from: 60 }, after: { label: 'Dragonnet', max: 1100, from: 0, to: 60 } });
    expect(victoryGauge(legacy, stageXp({ stages: [{ key: 'hatchling', xp: 50 }] })).after).toEqual({ label: 'Dragonnet', max: 1150, from: 10, to: 110 });
  });

  it('names the stages it was built from (the XP block first), so the dragon card follows the note', () => {
    const g = victoryGauge(p({ total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 }, stay('hatchling')), T);
    expect(g.stages).toEqual({ before: 'hatchling', after: 'young' });
    expect(g.grew).toBe(true);
  });
});

describe('the victory laurel at each phase', () => {
  const T = DEFAULT_STAGE_XP;
  const grown = (xpOf: typeof T) =>
    victoryGauge({ xp: { session: 51, bonuses: [], total_before: 60, total_after: 160 }, dragon: { stage_before: 'egg', stage_after: 'hatchling', needs_name: true } }, xpOf);

  it('fills the old scale, then shows the new one with its note', () => {
    const g = grown(T);
    expect(victoryLaurel(g, 'start')).toEqual({ label: 'Œuf', max: 100, value: 60, grewNote: false });
    expect(victoryLaurel(g, 'filled')).toEqual({ label: 'Œuf', max: 100, value: 100, grewNote: false });
    expect(victoryLaurel(g, 'after')).toEqual({ label: 'Dragonnet', max: 1100, value: 60, grewNote: true });
  });

  it('rescales the filled phase when the stage table arrives mid-animation', () => {
    // The catalogue lowers the hatchling to 50 after the fill started: the old scale is 50 wide now.
    const late = grown(stageXp({ stages: [{ key: 'hatchling', xp: 50 }] }));
    expect(victoryLaurel(late, 'filled')).toEqual({ label: 'Œuf', max: 50, value: 50, grewNote: false });
  });

  it('stays on one scale without a note when the dragon does not grow', () => {
    const g = victoryGauge({ xp: { session: 51, bonuses: [], total_before: 487, total_after: 538 }, dragon: { stage_before: 'hatchling', stage_after: 'hatchling', needs_name: false } }, T);
    expect(victoryLaurel(g, 'start')).toEqual({ label: 'Dragonnet', max: 1100, value: 387, grewNote: false });
    expect(victoryLaurel(g, 'after')).toEqual({ label: 'Dragonnet', max: 1100, value: 438, grewNote: false });
  });
});
