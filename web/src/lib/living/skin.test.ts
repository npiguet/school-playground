import { describe, expect, it } from 'vitest';
import { BONES, CELL, FRAME, GRID, VERTS, buildMesh, rotAbout, scaleAbout, skinPoint, translate, weightsAt, type Affine } from './skin';

const apply = (m: Affine, [x, y]: readonly [number, number]) => [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]];
const bonesOf = (...ms: Affine[]) => Float32Array.from(ms.flat());
const I = translate(0, 0);
const patterned = () => Uint8Array.from({ length: VERTS * VERTS * BONES.length }, (_, n) => n % 251);

describe('bones and skinning', () => {
  it('turns about the pivot, which stays put', () => {
    expect(apply(rotAbout([630, 480], 0.3), [630, 480]).map((v) => +v.toFixed(9))).toEqual([630, 480]);
    expect(apply(scaleAbout([640, 620], 1.1, 0.9), [640, 620]).map((v) => +v.toFixed(9))).toEqual([640, 620]);
    expect(apply(translate(0, -3.6), [10, 20])).toEqual([10, 16.4]);
  });

  it('leaves a point with no weight where it is', () => {
    const bones = bonesOf(rotAbout([0, 0], 1), I, I, I, I, translate(5, 5));
    expect(skinPoint([100, 200], [0, 0, 0, 0, 0, 0], bones)).toEqual([100, 200]);
  });

  it('moves a fully weighted point with its bone, half weighted halfway (the rest bone is implicit)', () => {
    const head = rotAbout([500, 500], 0.1);
    const bones = bonesOf(head, I, I, I, I, I);
    const full = skinPoint([600, 300], [1, 0, 0, 0, 0, 0], bones);
    const [hx, hy] = apply(head, [600, 300]);
    expect(full[0]).toBeCloseTo(hx, 3);
    expect(full[1]).toBeCloseTo(hy, 3);
    const half = skinPoint([600, 300], [0.5, 0, 0, 0, 0, 0], bones);
    expect(half[0]).toBeCloseTo((600 + hx) / 2, 3);
    expect(half[1]).toBeCloseTo((300 + hy) / 2, 3);
  });
});

describe('the vertex grid', () => {
  it('reads a vertex weight exactly and interpolates between vertices', () => {
    const w = patterned();
    const at = (i: number, j: number, b: number) => w[(j * VERTS + i) * BONES.length + b] / 255;
    expect(weightsAt(w, 3 * CELL, 5 * CELL)[2]).toBeCloseTo(at(3, 5, 2), 6);
    expect(weightsAt(w, 3.5 * CELL, 5 * CELL)[2]).toBeCloseTo((at(3, 5, 2) + at(4, 5, 2)) / 2, 6);
    expect(weightsAt(w, FRAME, FRAME)[5]).toBeCloseTo(at(GRID, GRID, 5), 6);
    expect(weightsAt(w, -40, 2000)[0]).toBeCloseTo(at(0, GRID, 0), 6);
  });

  it('builds 65 x 65 vertices over the frame, 8192 triangles, and carries each vertex weights', () => {
    const w = patterned();
    const m = buildMesh(w);
    expect(m.pos.length).toBe(VERTS * VERTS * 2);
    expect(m.indices.length).toBe(GRID * GRID * 6);
    expect(Math.max(...m.indices)).toBe(VERTS * VERTS - 1);
    expect([m.pos[0], m.pos[1], m.uv[0], m.uv[1]]).toEqual([0, 0, 0, 0]);
    const last = VERTS * VERTS - 1;
    expect([m.pos[2 * last], m.pos[2 * last + 1], m.uv[2 * last], m.uv[2 * last + 1]]).toEqual([FRAME, FRAME, 1, 1]);
    const k = 7 * VERTS + 9;
    expect(m.w0[4 * k + 3]).toBeCloseTo(w[k * 6 + 3] / 255, 6);
    expect(m.w1[2 * k + 1]).toBeCloseTo(w[k * 6 + 5] / 255, 6);
  });
});
