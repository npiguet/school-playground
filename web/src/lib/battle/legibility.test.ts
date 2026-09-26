import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../ui/contrast';

// Ruling C12: the text zone is semi-transparent, so its worst case is a black backdrop behind it
// (the lair) and its other extreme a white one. The ink must read at 7:1 (WCAG AAA) on both.
const kit = readFileSync('src/styles/kit.css', 'utf-8');
const app = readFileSync('src/app.css', 'utf-8');
const rgba = (name: string) => {
  const m = new RegExp(`--${name}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`).exec(kit);
  if (!m) throw new Error(`--${name} is not an rgba() token`);
  return m.slice(1).map(Number);
};
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const over = ([r, g, b, a]: number[], bg: number[]) => hex([r, g, b].map((v, i) => v * a + bg[i] * (1 - a)));
const INK = /--ink:\s*(#[0-9a-f]{6})/i.exec(app)![1];

describe('the battle text reads at 7:1 on any backdrop (Ruling C12)', () => {
  it('keeps the text zone at least 94 % opaque', () => expect(rgba('battle-text-bg')[3]).toBeGreaterThanOrEqual(0.94));
  it('reads over black and over white', () => {
    const bg = rgba('battle-text-bg');
    expect(contrastRatio(INK, over(bg, [0, 0, 0]))).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(INK, over(bg, [255, 255, 255]))).toBeGreaterThanOrEqual(7);
  });
});
