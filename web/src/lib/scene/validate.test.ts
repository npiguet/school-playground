import { describe, expect, it } from 'vitest';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotShape, type SceneDef, type ShapeMap } from './types';
import { validateScene, validateShapes } from './validate';

const e = (cx: number, cy: number, r = 5): HotspotShape => ({ kind: 'ellipse', cx, cy, rx: r, ry: r });

describe('validateShapes', () => {
  it('accepts well-placed ellipses and polygons', () => {
    const ok: ShapeMap = { a: e(30, 50), b: { kind: 'polygon', points: [[50, 40], [60, 40], [55, 50]] } };
    expect(validateShapes(ok)).toEqual([]);
  });
  it('rejects shapes outside the safe zone, under the HUD, or on the dialogue dock', () => {
    expect(validateShapes({ a: e(10, 50) })).toEqual(['a: outside the 4:3 safe zone (x 12.5-87.5)']);
    expect(validateShapes({ a: e(50, 12, 4) })).toEqual(['a: under the HUD band (y < 14)']);
    expect(validateShapes({ a: e(50, 85, 4) })).toEqual(['a: overlaps the dialogue dock']);
  });
  it('rejects overlapping hotspots and degenerate shapes', () => {
    expect(validateShapes({ a: e(40, 50), b: e(44, 50) })).toEqual(['a overlaps b']);
    expect(validateShapes({ a: { kind: 'ellipse', cx: 50, cy: 50, rx: 0, ry: 5 } })).toEqual(['a: radii must be > 0']);
    expect(validateShapes({ a: { kind: 'polygon', points: [[50, 50], [60, 60]] } })).toEqual([
      'a: a polygon needs at least 3 points',
    ]);
  });
  it('rejects a zero-area polygon (collinear points), which would clip-path to NaN%', () => {
    expect(validateShapes({ a: { kind: 'polygon', points: [[50, 50], [60, 50], [55, 50]] } })).toEqual([
      'a: polygon has zero area',
    ]);
  });
});

describe('validateScene', () => {
  const def = (id: string, shape: HotspotShape): HotspotDef => ({
    id,
    label: id,
    target: 'library',
    shape,
    labelPos: 'below',
    state: () => IDLE_HOTSPOT,
  });
  it('reports duplicate ids and out-of-range layers', () => {
    const scene: SceneDef = {
      id: 'camp',
      title: 'Le camp',
      background: '/art/scenes/hub_camp.webp',
      layers: [{ id: 'l', src: '/x.webp', alt: '', x: 120, y: 50, scale: 10, depth: 1, idle: 'none' }],
      hotspots: [def('a', e(30, 50)), def('a', e(60, 50))],
      ambience: { particles: 'none', music: null },
      narrator: { enter: null, tour: null },
      preload: [],
    };
    expect(validateScene(scene)).toEqual(['duplicate hotspot id: a', 'layer l: position/scale out of range']);
  });
  it('asks a hotspot without a plaque for an accessible name (playability #23)', () => {
    const scene: SceneDef = {
      id: 'library',
      title: 'La tente',
      background: '/x.webp',
      layers: [],
      hotspots: [{ ...def('owl', e(30, 50)), label: '' }, { ...def('cat', e(60, 50)), label: '', ariaLabel: 'Le chat' }],
      ambience: { particles: 'none', music: null },
      narrator: { enter: null, tour: null },
      preload: [],
    };
    expect(validateScene(scene)).toEqual(['owl: a hotspot without a label needs an ariaLabel']);
  });
});
