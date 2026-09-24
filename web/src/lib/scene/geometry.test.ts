import { describe, expect, it } from 'vitest';
import {
  DIALOGUE_DOCK,
  HUD_BAND,
  SAFE_ZONE,
  boxInside,
  boxesOverlap,
  clipPath,
  parallaxOffset,
  pointerToNorm,
  shapeBox,
  stageBox,
} from './geometry';

describe('stageBox (Ruling 3)', () => {
  it('fits the 16:9 art to the height on iPad landscape, cropping the sides', () => {
    const b = stageBox(1180, 820);
    expect(b.width).toBeCloseTo(1457.78, 1);
    expect(b.height).toBeCloseTo(820, 5);
    expect(b.left).toBeCloseTo(-138.89, 1);
    expect(b.top).toBeCloseTo(0, 5);
  });
  it('shows the whole art on a 16:9 laptop', () => {
    const b = stageBox(1280, 720);
    expect(b.width).toBeCloseTo(1280, 5);
    expect(b.height).toBeCloseTo(720, 5);
    expect(b.left).toBeCloseTo(0, 5);
    expect(b.top).toBeCloseTo(0, 5);
  });
  it('letterboxes the sides on ultra-wide screens', () => {
    const b = stageBox(2560, 1080);
    expect(b.width).toBeCloseTo(1920, 5);
    expect(b.left).toBeCloseTo(320, 5);
    expect(b.top).toBeCloseTo(0, 5);
  });
  it('shrinks below 4:3 so the safe zone stays whole', () => {
    const b = stageBox(1000, 900);
    expect(b.width).toBeCloseTo(1333.33, 1);
    expect(b.height).toBeCloseTo(750, 1);
    expect(b.top).toBeCloseTo(75, 1);
  });
  it('always keeps the 4:3 safe zone inside the viewport', () => {
    for (const [vw, vh] of [[1180, 820], [1024, 768], [1366, 1024], [1280, 720], [1440, 900], [2560, 1080], [1000, 900]]) {
      const b = stageBox(vw, vh);
      const left = b.left + (SAFE_ZONE.x / 100) * b.width;
      const right = b.left + ((SAFE_ZONE.x + SAFE_ZONE.w) / 100) * b.width;
      expect(left, `${vw}x${vh}`).toBeGreaterThanOrEqual(-1e-6);
      expect(right, `${vw}x${vh}`).toBeLessThanOrEqual(vw + 1e-6);
      expect(b.top + b.height, `${vw}x${vh}`).toBeLessThanOrEqual(vh + 1e-6);
    }
  });
});

describe('shapes', () => {
  it('boxes an ellipse and a polygon', () => {
    expect(shapeBox({ kind: 'ellipse', cx: 30, cy: 53, rx: 7.5, ry: 8 })).toEqual({ x: 22.5, y: 45, w: 15, h: 16 });
    expect(shapeBox({ kind: 'polygon', points: [[10, 20], [30, 20], [20, 40]] })).toEqual({ x: 10, y: 20, w: 20, h: 20 });
  });
  it('clips relative to the shape box', () => {
    expect(clipPath({ kind: 'ellipse', cx: 50, cy: 50, rx: 5, ry: 5 })).toBe('ellipse(50% 50% at 50% 50%)');
    expect(clipPath({ kind: 'polygon', points: [[10, 20], [30, 20], [20, 40]] })).toBe('polygon(0% 0%, 100% 0%, 50% 100%)');
  });
  it('never emits NaN for a collinear polygon (zero-width or zero-height box)', () => {
    const flat = clipPath({ kind: 'polygon', points: [[10, 20], [30, 20], [20, 20]] });
    expect(flat).not.toContain('NaN');
    const thin = clipPath({ kind: 'polygon', points: [[10, 20], [10, 40], [10, 30]] });
    expect(thin).not.toContain('NaN');
  });
  it('treats touching boxes as not overlapping', () => {
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });
  it('checks containment inclusively', () => {
    expect(boxInside({ x: 12.5, y: 15, w: 75, h: 10 }, SAFE_ZONE)).toBe(true);
    expect(boxInside({ x: 12, y: 15, w: 5, h: 10 }, SAFE_ZONE)).toBe(false);
  });
  it('exposes the layout constants of Ruling 3', () => {
    expect(SAFE_ZONE).toEqual({ x: 12.5, y: 0, w: 75, h: 100 });
    expect(HUD_BAND).toBe(14);
    expect(DIALOGUE_DOCK).toEqual({ x: 27, y: 80, w: 60.5, h: 20 });
  });
});

describe('parallax', () => {
  it('moves deeper layers further, against the pointer, half as much vertically', () => {
    expect(parallaxOffset(2, 1, -1)).toEqual({ x: -1.2, y: 0.6 });
    expect(parallaxOffset(3, -1, 0)).toEqual({ x: 1.8, y: 0 });
  });
  it('never moves depth 0 and never returns -0', () => {
    const o = parallaxOffset(0, 1, 1);
    expect(o).toEqual({ x: 0, y: 0 });
    expect(Object.is(o.x, -0)).toBe(false);
    expect(Object.is(parallaxOffset(2, 0, 0).x, -0)).toBe(false);
  });
  it('normalises the pointer to [-1, 1]', () => {
    expect(pointerToNorm(0, 0, 1000, 500)).toEqual({ nx: -1, ny: -1 });
    expect(pointerToNorm(500, 250, 1000, 500)).toEqual({ nx: 0, ny: 0 });
    expect(pointerToNorm(2000, -5, 1000, 500)).toEqual({ nx: 1, ny: -1 });
    expect(pointerToNorm(10, 10, 0, 0)).toEqual({ nx: 0, ny: 0 });
  });
});
