// The living dragon's rigs (spec 2026-10-02 living dragon, "Rigs", "Tests"): each authored rig is baked
// from the rig file and the sprite as they are now, its pinned feet get zero weight, its rigid bones
// never sum past one, and the ancestral's horn tip takes the head's weight.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BONES, CELL, FRAME, VERTS, weightsAt } from './skin';
import { decodeRig, LIVING_STAGES, livingStage, type RigFile } from './rigs';

const FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { eager: true, import: 'default' });
const SOURCE = JSON.parse(readFileSync('../tools/art/rig.json', 'utf-8')) as Record<string, { bones: Record<string, Record<string, unknown>>; pin: unknown }>;
const STAGES = Object.keys(SOURCE).filter((k) => !k.startsWith('_'));
const fileOf = (stage: string) => FILES[`./rig/dragon_${stage}.json`];
const rigOf = (stage: string) => decodeRig(fileOf(stage));
const HEAD = BONES.indexOf('head');

/** Python's json.dumps(sort_keys=True, separators=(',', ':')) for integers, booleans, strings, lists. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function numbers(v: unknown, out: number[] = []): number[] {
  if (typeof v === 'number') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => numbers(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => numbers(x, out));
  return out;
}

describe('the rigs', () => {
  it('holds integers only (the bake hash reads the same in Python and here)', () => {
    expect(numbers(SOURCE).filter((n) => !Number.isInteger(n))).toEqual([]);
  });

  it.each(STAGES)('%s: baked from the rig and the sprite as they are now', (stage) => {
    const f = fileOf(stage);
    expect(f, `${stage}: run tools/art/run_docker.sh rig bake`).toBeDefined();
    const h = createHash('sha256').update(canonical(SOURCE[stage]), 'utf8').update('\n').update(readFileSync(`public/art/dragon/dragon_${stage}_cut.webp`));
    expect(f.source, `${stage}: the rig or the sprite changed since the bake (tools/art/run_docker.sh rig bake)`).toBe(h.digest('hex'));
    expect(f.stage).toBe(stage);
  });

  it.each(STAGES)('%s: every bone has its pivot inside the frame', (stage) => {
    const rig = rigOf(stage);
    for (const b of BONES) {
      const [x, y] = rig.pivots[b];
      expect(x >= 0 && x <= FRAME && y >= 0 && y <= FRAME, `${stage} ${b}`).toBe(true);
    }
  });

  it.each(STAGES)('%s: the feet get zero weight, in a box that reaches the bottom', (stage) => {
    const rig = rigOf(stage);
    const [x0, y0, x1, y1] = rig.feet;
    expect(y1).toBe(FRAME);
    expect(y1 - y0).toBeGreaterThanOrEqual(3 * CELL);
    expect(x1 - x0).toBeGreaterThanOrEqual(10 * CELL);
    for (let j = 0; j < VERTS; j++) {
      for (let i = 0; i < VERTS; i++) {
        const [x, y] = [i * CELL, j * CELL];
        if (x < x0 || x > x1 || y < y0) continue;
        const w = Array.from(rig.weights.slice((j * VERTS + i) * 6, (j * VERTS + i) * 6 + 6));
        expect(w, `${stage} vertex (${x}, ${y})`).toEqual([0, 0, 0, 0, 0, 0]);
      }
    }
  });

  it.each(STAGES)('%s: the rigid bones never sum past one; each region carries its bone', (stage) => {
    const rig = rigOf(stage);
    const max = new Array(6).fill(0);
    for (let k = 0; k < VERTS * VERTS; k++) {
      const w = rig.weights.slice(k * 6, k * 6 + 6);
      expect(w[0] + w[1] + w[2] + w[3], `${stage} vertex ${k}`).toBeLessThanOrEqual(255 + 2); // rounding of four bytes
      for (let b = 0; b < 6; b++) max[b] = Math.max(max[b], w[b]);
    }
    BONES.forEach((b, i) => {
      const spec = SOURCE[stage].bones[b];
      const painted = 'poly' in spec || 'ellipse' in spec || 'all' in spec;
      if (painted) expect(max[i], `${stage} ${b}`).toBeGreaterThanOrEqual(230);
      else expect(max[i], `${stage} ${b} has no region`).toBe(0);
    });
  });

  it("gives the ancestral's horn tip the head's weight (it lagged in the spike)", () => {
    // The right-hand horn's tip, read off the grid view (rig grid --stage ancestral), and its shaft.
    for (const [x, y] of [[603, 14], [606, 22]]) expect(weightsAt(rigOf('ancestral').weights, x, y)[HEAD], `(${x}, ${y})`).toBeGreaterThanOrEqual(0.9);
  });

  // Each wing's claw tip and the far tips of its edges, read off the grid views (playtest 2026-10-02:
  // the user saw claw tips and wing edges left behind, and the ancestral's front claw tip on the head).
  const WING_TIPS: [string, 'wingL' | 'wingR', string, number, number][] = [
    ['hatchling', 'wingL', 'lower tip of the leading edge', 162, 660],
    ['hatchling', 'wingR', 'claw tip', 693, 324],
    ['hatchling', 'wingR', 'lower tip', 860, 620],
    ['young', 'wingL', 'claw tip', 318, 142],
    ['young', 'wingL', 'lower tip', 107, 767],
    ['young', 'wingR', 'claw tip', 891, 194],
    ['young', 'wingR', 'lower tip', 884, 741],
    ['adult', 'wingR', 'lower tip', 895, 752],
    ['illustre', 'wingL', 'claw tip', 476, 148],
    ['illustre', 'wingL', 'lower finger beside the tail', 103, 810],
    ['illustre', 'wingR', 'claw tip', 946, 187],
    ['illustre', 'wingR', 'lower tip', 814, 730],
    ['ancestral', 'wingL', 'claw tip', 510, 155],
    ['ancestral', 'wingR', 'claw tip', 972, 172],
  ];
  it.each(WING_TIPS)('%s: the %s carries its %s (%i, %i)', (stage, bone, _what, x, y) => {
    expect(weightsAt(rigOf(stage).weights, x, y)[BONES.indexOf(bone)]).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps the head off the ancestral's front claw tip, under the horn", () => {
    expect(weightsAt(rigOf('ancestral').weights, 510, 155)[HEAD]).toBeLessThanOrEqual(0.1);
  });

  it('animates a stage only when its rig is baked, never the egg', () => {
    expect(livingStage('egg')).toBeNull();
    expect(livingStage('adult')).toBe('adult');
    expect(livingStage('ancestral')).toBe('ancestral');
  });

  it('rigs every hatched stage, and nothing else', () => {
    expect([...STAGES].sort()).toEqual([...LIVING_STAGES].sort());
    for (const s of LIVING_STAGES) expect(livingStage(s), s).toBe(s);
  });

  it('refuses a rig file of the wrong size', () => {
    expect(() => decodeRig({ ...fileOf('adult'), weights: 'AAAA' })).toThrow();
  });
});
