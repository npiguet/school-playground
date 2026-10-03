// The living figures' rigs (spec 2026-10-02 living dragon, "Rigs", "Tests"; spec 2026-10-03 living
// battle, "Tests"): every authored rig, the dragon's stages and the battle's foes, is baked from the rig
// file and the sprite as they are now, in its creature's bone order; its pinned feet (or base) get zero
// weight; its rigid bones never sum past one; the probed tips take their bone.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOE_SPRITES } from './foes';
import { bonesOf } from './pose';
import { BONES, CELL, FRAME, SLOTS, VERTS, weightsAt } from './skin';
import { decodeRig, FOE_RIGS, FOE_WIDTH, LIVING_STAGES, livingStage, motionOf, type FoeRig, type LivingRig, type RigFile } from './rigs';

interface RigBlock {
  sprite?: string;
  bones: Record<string, Record<string, unknown>>;
  pin: unknown;
}

const DRAGON_FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { eager: true, import: 'default' });
const FOE_FILES = import.meta.glob<RigFile>('./rig/foe_*.json', { eager: true, import: 'default' });
const SOURCE = JSON.parse(readFileSync('../tools/art/rig.json', 'utf-8')) as Record<string, RigBlock>;
const KEYS = Object.keys(SOURCE).filter((k) => !k.startsWith('_'));
const isDragon = (k: string) => (LIVING_STAGES as readonly string[]).includes(k);
const DRAGONS = KEYS.filter(isDragon);
const FOES = KEYS.filter((k) => !isDragon(k));
const fileOf = (k: string) => (isDragon(k) ? DRAGON_FILES[`./rig/dragon_${k}.json`] : FOE_FILES[`./rig/foe_${k}.json`]);
const spriteOf = (k: string) => SOURCE[k].sprite ?? `web/public/art/dragon/dragon_${k}_cut.webp`;
const rigOf = (k: string) => decodeRig(fileOf(k));
const HEAD = BONES.indexOf('head');
const PAINTED = ['poly', 'polys', 'ellipse', 'all'];

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

  it('keys every rig by a dragon stage or a foe', () => {
    expect(FOES.filter((k) => !(FOE_RIGS as readonly string[]).includes(k))).toEqual([]);
  });

  it("names each foe's sprite as the game serves it; a dragon stage's is implied", () => {
    for (const k of FOES) expect(SOURCE[k].sprite, k).toBe(`web/public${FOE_SPRITES[k as FoeRig]}`);
    for (const k of DRAGONS) expect(SOURCE[k].sprite, k).toBeUndefined();
  });

  it.each(KEYS)("%s: its bones in its creature's slot order", (k) => {
    expect(Object.keys(SOURCE[k].bones)).toEqual([...bonesOf(motionOf(k as LivingRig))]);
  });

  it.each(KEYS)('%s: baked from the rig and the sprite as they are now', (k) => {
    const f = fileOf(k);
    expect(f, `${k}: run tools/art/run_docker.sh rig bake --stage ${k}`).toBeDefined();
    const h = createHash('sha256').update(canonical(SOURCE[k]), 'utf8').update('\n').update(readFileSync(`../${spriteOf(k)}`));
    expect(f.source, `${k}: the rig or the sprite changed since the bake (tools/art/run_docker.sh rig bake --stage ${k})`).toBe(h.digest('hex'));
    expect(f.stage).toBe(k);
  });

  it('gives each foe rig the portrait width, and no dragon one', () => {
    for (const k of FOES) expect(fileOf(k).width, k).toBe(FOE_WIDTH);
    for (const k of DRAGONS) expect(fileOf(k).width, k).toBeUndefined();
  });

  it.each(KEYS)('%s: every bone has its pivot inside the frame', (k) => {
    const rig = rigOf(k);
    for (const b of rig.bones) {
      const [x, y] = rig.pivots[b];
      expect(x >= 0 && x <= FRAME && y >= 0 && y <= FRAME, `${k} ${b}`).toBe(true);
    }
  });

  it.each(KEYS)('%s: the feet get zero weight, in a box that reaches the bottom', (k) => {
    const rig = rigOf(k);
    const [x0, y0, x1, y1] = rig.feet;
    expect(y1).toBe(FRAME);
    expect(y1 - y0).toBeGreaterThanOrEqual(3 * CELL);
    expect(x1 - x0).toBeGreaterThanOrEqual(10 * CELL);
    for (let j = 0; j < VERTS; j++) {
      for (let i = 0; i < VERTS; i++) {
        const [x, y] = [i * CELL, j * CELL];
        if (x < x0 || x > x1 || y < y0) continue;
        const w = Array.from(rig.weights.slice((j * VERTS + i) * SLOTS, (j * VERTS + i) * SLOTS + SLOTS));
        expect(w, `${k} vertex (${x}, ${y})`).toEqual([0, 0, 0, 0, 0, 0]);
      }
    }
  });

  it.each(KEYS)('%s: the rigid bones never sum past one; each region carries its bone', (k) => {
    const rig = rigOf(k);
    const max = new Array(SLOTS).fill(0);
    for (let n = 0; n < VERTS * VERTS; n++) {
      const w = rig.weights.slice(n * SLOTS, n * SLOTS + SLOTS);
      expect(w[0] + w[1] + w[2] + w[3], `${k} vertex ${n}`).toBeLessThanOrEqual(255 + 2); // rounding of four bytes
      for (let b = 0; b < SLOTS; b++) max[b] = Math.max(max[b], w[b]);
    }
    rig.bones.forEach((b, i) => {
      const spec = SOURCE[k].bones[b];
      const painted = PAINTED.some((p) => p in spec);
      if (painted) expect(max[i], `${k} ${b}`).toBeGreaterThanOrEqual(230);
      else expect(max[i], `${k} ${b} has no region`).toBe(0);
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

  it('rigs every hatched stage', () => {
    expect([...DRAGONS].sort()).toEqual([...LIVING_STAGES].sort());
    for (const s of LIVING_STAGES) expect(livingStage(s), s).toBe(s);
  });

  it('refuses a rig file of the wrong size', () => {
    expect(() => decodeRig({ ...fileOf('adult'), weights: 'AAAA' })).toThrow();
  });

  it('refuses a rig whose pivots miss a bone of its creature', () => {
    const f = fileOf('adult');
    const { head: _gone, ...pivots } = f.pivots;
    expect(() => decodeRig({ ...f, pivots: pivots as typeof f.pivots })).toThrow(/head/);
  });

  it('refuses a rig that is neither a dragon stage nor a foe, or wider than the frame', () => {
    expect(() => decodeRig({ ...fileOf('adult'), stage: 'griffon' })).toThrow(/griffon/);
    expect(() => decodeRig({ ...fileOf('adult'), width: 1100 })).toThrow(/1100/);
  });

  it("decodes a dragon rig with the dragon's bones and the whole frame's width", () => {
    const rig = rigOf('adult');
    expect(rig.id).toBe('adult');
    expect(rig.bones).toEqual(['head', 'wingL', 'wingR', 'tail', 'chest', 'lift']);
    expect(rig.width).toBe(1024);
  });
});
