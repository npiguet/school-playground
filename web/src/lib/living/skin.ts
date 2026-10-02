// The living dragon's mesh and bones (spec 2026-10-02 living dragon, "Technique"): a 64 x 64 grid over
// the 1024 px frame (3.5 % margin around it so wing tips may move out a little), six bones as 2D
// affine maps (y down), linear-blend skinning with an implicit rest bone: p + sum w_i (M_i p - p).
// The vertex shader (renderer.ts) does the same sum as skinPoint below; the weights are baked per
// vertex by tools/art/rig.py: weights[(j * VERTS + i) * 6 + b], vertex (i, j) at (i * CELL, j * CELL).
export const FRAME = 1024;
export const GRID = 64;
export const VERTS = GRID + 1;
export const CELL = FRAME / GRID;
export const MARGIN = 0.035;
export const BONES = ['head', 'wingL', 'wingR', 'tail', 'chest', 'lift'] as const;
export type Bone = (typeof BONES)[number];
export type Point = readonly [number, number];
/** A 2D affine map as a column-major mat3 (GLSL order): columns (a, b, 0), (c, d, 0), (tx, ty, 1). */
export type Affine = readonly [number, number, number, number, number, number, number, number, number];

export function rotAbout([cx, cy]: Point, a: number): Affine {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, s, 0, -s, c, 0, cx - (c * cx - s * cy), cy - (s * cx + c * cy), 1];
}

export function scaleAbout([cx, cy]: Point, sx: number, sy: number): Affine {
  return [sx, 0, 0, 0, sy, 0, cx - sx * cx, cy - sy * cy, 1];
}

export function translate(dx: number, dy: number): Affine {
  return [1, 0, 0, 0, 1, 0, dx, dy, 1];
}

/** Where a frame point goes under the pose (`bones`: six column-major mat3, BONES order). */
export function skinPoint([x, y]: Point, w: ArrayLike<number>, bones: Float32Array): [number, number] {
  let dx = 0;
  let dy = 0;
  for (let b = 0; b < BONES.length; b++) {
    const m = b * 9;
    dx += w[b] * (bones[m] * x + bones[m + 3] * y + bones[m + 6] - x);
    dy += w[b] * (bones[m + 1] * x + bones[m + 4] * y + bones[m + 7] - y);
  }
  return [x + dx, y + dy];
}

/** The six bone weights (0..1) at a frame point, bilinear between the grid's vertices, clamped to it. */
export function weightsAt(weights: Uint8Array, x: number, y: number): Float32Array {
  const gx = Math.min(GRID, Math.max(0, x / CELL));
  const gy = Math.min(GRID, Math.max(0, y / CELL));
  const i0 = Math.min(GRID - 1, Math.floor(gx));
  const j0 = Math.min(GRID - 1, Math.floor(gy));
  const fx = gx - i0;
  const fy = gy - j0;
  const out = new Float32Array(BONES.length);
  for (let b = 0; b < BONES.length; b++) {
    const at = (i: number, j: number) => weights[(j * VERTS + i) * BONES.length + b] / 255;
    out[b] = (1 - fx) * (1 - fy) * at(i0, j0) + fx * (1 - fy) * at(i0 + 1, j0) + (1 - fx) * fy * at(i0, j0 + 1) + fx * fy * at(i0 + 1, j0 + 1);
  }
  return out;
}

export interface Mesh {
  /** Frame px, two per vertex. */
  pos: Float32Array;
  /** Texture coordinates, two per vertex. */
  uv: Float32Array;
  /** head, wingL, wingR, tail. */
  w0: Float32Array;
  /** chest, lift. */
  w1: Float32Array;
  indices: Uint16Array;
}

export function buildMesh(weights: Uint8Array): Mesh {
  const n = VERTS * VERTS;
  const pos = new Float32Array(n * 2);
  const uv = new Float32Array(n * 2);
  const w0 = new Float32Array(n * 4);
  const w1 = new Float32Array(n * 2);
  for (let j = 0; j < VERTS; j++) {
    for (let i = 0; i < VERTS; i++) {
      const k = j * VERTS + i;
      pos[2 * k] = i * CELL;
      pos[2 * k + 1] = j * CELL;
      uv[2 * k] = i / GRID;
      uv[2 * k + 1] = j / GRID;
      const o = k * BONES.length;
      for (let b = 0; b < 4; b++) w0[4 * k + b] = weights[o + b] / 255;
      w1[2 * k] = weights[o + 4] / 255;
      w1[2 * k + 1] = weights[o + 5] / 255;
    }
  }
  const indices = new Uint16Array(GRID * GRID * 6);
  let t = 0;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * VERTS + i;
      const b = a + 1;
      const c = a + VERTS;
      const d = c + 1;
      // The diagonal alternates, so the mesh has no directional bias.
      const quad = (i + j) & 1 ? [a, b, d, a, d, c] : [a, b, c, b, d, c];
      for (const v of quad) indices[t++] = v;
    }
  }
  return { pos, uv, w0, w1, indices };
}
