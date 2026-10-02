// The worn pieces on the living dragon (spec 2026-10-02 living dragon, "Pieces"; plan Ruling R2): one
// atlas cell each, drawn in DRAW_ORDER, each skinned rigidly with the dragon's weights at its anchor.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCESSORY_MANIFEST, accessoryLayers } from '../world/accessories';
import { ATLAS, ATLAS_CELL, pieceDraws, placePieces } from './atlas';
import { poseAt } from './pose';
import { decodeRig, type RigFile } from './rigs';
import { BONES, FRAME, skinPoint } from './skin';

const ADULT = decodeRig(JSON.parse(readFileSync('src/lib/living/rig/dragon_adult.json', 'utf-8')) as RigFile);
const WORN = ['echo-tete', 'hydre-cou', 'lethe-queue', 'sirenes-dos'];

describe('the piece atlas', () => {
  it('keeps the draw order, one cell each, inside the atlas', () => {
    const placed = placePieces(accessoryLayers(WORN, 'adult'));
    expect(placed.map((p) => p.item)).toEqual(['lethe-queue', 'sirenes-dos', 'hydre-cou', 'echo-tete']);
    expect(new Set(placed.map((p) => `${p.atlas[0]},${p.atlas[1]}`)).size).toBe(4);
    for (const p of placed) {
      expect(p.atlasUv.every((v) => v >= 0 && v <= 1)).toBe(true);
      expect(p.atlas[2]).toBeLessThanOrEqual(ATLAS_CELL);
      expect(p.atlas[3]).toBeLessThanOrEqual(ATLAS_CELL);
      expect(p.atlasUv[2] - p.atlasUv[0]).toBeCloseTo(p.atlas[2] / ATLAS, 9);
    }
  });

  it('anchors a piece at the centre of its box in the frame', () => {
    const [p] = placePieces(accessoryLayers(['hydre-cou'], 'adult'));
    const e = ACCESSORY_MANIFEST['hydre-cou'].adult!;
    expect(p.frame[0]).toBeCloseTo(e.x * FRAME, 6);
    expect(p.frame[3]).toBeCloseTo((e.y + e.h) * FRAME, 6);
    expect(p.anchor[0]).toBeCloseTo((e.x + e.w / 2) * FRAME, 6);
    expect(p.anchor[1]).toBeCloseTo((e.y + e.h / 2) * FRAME, 6);
  });

  it('fits every piece of the manifest, at every stage, in one cell', () => {
    for (const [item, stages] of Object.entries(ACCESSORY_MANIFEST)) {
      for (const [stage, e] of Object.entries(stages)) {
        expect(Math.ceil(e!.w * FRAME), `${item} ${stage}`).toBeLessThanOrEqual(ATLAS_CELL);
        expect(Math.ceil(e!.h * FRAME), `${item} ${stage}`).toBeLessThanOrEqual(ATLAS_CELL);
      }
    }
  });

  it('refuses more than four pieces', () => {
    const one = accessoryLayers(['hydre-cou'], 'adult')[0];
    expect(() => placePieces([one, one, one, one, one])).toThrow();
  });
});

describe('a piece rides rigidly', () => {
  it('moves its four corners with one and the same weights, keeping its shape (the saddle too)', () => {
    const placed = placePieces(accessoryLayers(['sirenes-dos', 'hydre-cou', 'echo-tete', 'lethe-queue'], 'adult'));
    const draws = pieceDraws(placed, ADULT.weights);
    for (const [n, d] of draws.entries()) {
      const [x0, y0, x1, y1] = d.frame;
      const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const;
      for (let t = 0; t < 12; t += 0.37) {
        const bones = poseAt(t, ADULT.pivots, 3); // twice the game's amplitude: any stretch would show
        const q = corners.map((c) => skinPoint(c, d.weights, bones));
        const width = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
        const height = Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]);
        const diag = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
        expect(Math.abs(width / (x1 - x0) - 1), `${placed[n].item} width at ${t}`).toBeLessThan(0.05);
        expect(Math.abs(height / (y1 - y0) - 1), `${placed[n].item} height at ${t}`).toBeLessThan(0.05);
        expect(Math.abs(diag / Math.hypot(x1 - x0, y1 - y0) - 1), `${placed[n].item} shear at ${t}`).toBeLessThan(0.05);
      }
    }
  });

  it('takes no breath: a piece has no chest weight and keeps its size across poses (Ruling L5)', () => {
    const chest = BONES.indexOf('chest');
    const placed = placePieces(accessoryLayers(WORN, 'adult'));
    const draws = pieceDraws(placed, ADULT.weights);
    for (const [n, d] of draws.entries()) {
      expect(d.weights[chest], `${placed[n].item} chest weight`).toBe(0);
      const [x0, y0, x1, y1] = d.frame;
      const size = (t: number) => {
        const bones = poseAt(t, ADULT.pivots, 3);
        const a = skinPoint([x0, y0], d.weights, bones);
        const b = skinPoint([x1, y1], d.weights, bones);
        return Math.hypot(b[0] - a[0], b[1] - a[1]);
      };
      const rest = Math.hypot(x1 - x0, y1 - y0);
      // Blending part-weighted turns leaves a shrink under 0.03 %; the breath scaled the saddle by 0.4 %.
      for (let t = 0; t < 12; t += 0.29) expect(Math.abs(size(t) / rest - 1), `${placed[n].item} size at ${t}`).toBeLessThan(1e-3);
    }
  });

  it('takes the dragon weights at its anchor', () => {
    const [p] = placePieces(accessoryLayers(['echo-tete'], 'adult'));
    const [d] = pieceDraws([p], ADULT.weights);
    expect(d.weights[0]).toBeGreaterThan(0.8); // the helmet goes with the head
  });
});
