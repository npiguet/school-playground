import { describe, expect, it } from 'vitest';
import { AMPLITUDE, BREATH_BONES, DRAGON_MOTION, bonesOf, frameDue, poseAt, poseFor, type CreatureMotion, type Pivots, type Wave } from './pose';
import { FOE_MOTIONS } from './foes';
import { FOE_RIGS } from './stages';

const PIVOTS: Pivots = { head: [630, 480], wingL: [520, 525], wingR: [715, 335], tail: [330, 610], chest: [640, 620], lift: [640, 900] };
const DEG = 180 / Math.PI;
const angle = (p: Float32Array, bone: number) => Math.atan2(p[bone * 9 + 1], p[bone * 9]) * DEG;

function peaks(amplitude: number) {
  const out = { head: 0, wingL: 0, wingR: 0, tail: 0, chestX: 0, chestY: 0, lift: 0 };
  for (let t = 0; t < 120; t += 0.005) {
    const p = poseAt(t, PIVOTS, amplitude);
    out.head = Math.max(out.head, Math.abs(angle(p, 0)));
    out.wingL = Math.max(out.wingL, Math.abs(angle(p, 1)));
    out.wingR = Math.max(out.wingR, Math.abs(angle(p, 2)));
    out.tail = Math.max(out.tail, Math.abs(angle(p, 3)));
    out.chestX = Math.max(out.chestX, p[4 * 9] - 1);
    out.chestY = Math.max(out.chestY, p[4 * 9 + 4] - 1);
    out.lift = Math.max(out.lift, Math.abs(p[5 * 9 + 7]));
  }
  return out;
}

describe('the idle motion', () => {
  it('defaults to 1.5 times the spike', () => {
    expect(AMPLITUDE).toBe(1.5);
    expect(poseAt(2.3, PIVOTS)).toEqual(poseAt(2.3, PIVOTS, 1.5));
  });

  it('moves as far as the spec says at 1.5x, and no further', () => {
    const p = peaks(AMPLITUDE);
    expect(p.head).toBeLessThanOrEqual(3.0 + 1e-6); // 2.25 + 0.75 deg
    expect(p.head).toBeGreaterThan(2.7);
    expect(p.wingL).toBeCloseTo(2.7, 2);
    expect(p.wingR).toBeCloseTo(2.4, 2);
    expect(p.tail).toBeLessThanOrEqual(4.5 + 1e-6); // 3.6 + 0.9 deg
    expect(p.tail).toBeGreaterThan(4.0);
    expect(p.chestX).toBeCloseTo(0.024, 3);
    expect(p.chestY).toBeCloseTo(0.012, 3);
    expect(p.lift).toBeCloseTo(3.6, 2);
  });

  it('stands still at amplitude 0', () => {
    const p = poseAt(7.7, PIVOTS, 0);
    for (let b = 0; b < 6; b++) expect(Array.from(p.slice(b * 9, b * 9 + 9)).map((v) => Math.abs(v) < 1e-9 ? 0 : v)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('never repeats on the breath period (the parts are out of step)', () => {
    expect(angle(poseAt(1, PIVOTS), 0)).not.toBeCloseTo(angle(poseAt(1 + 4.8, PIVOTS), 0), 3);
  });
});

describe('the 30 fps gate', () => {
  it('draws the first frame, then one frame in two at 60 Hz', () => {
    expect(frameDue(1000, null)).toBe(true);
    expect(frameDue(1016.7, 1000)).toBe(false);
    expect(frameDue(1033.4, 1000)).toBe(true);
    expect(frameDue(1030, 1000)).toBe(true); // rAF jitter: up to 4 ms early still counts
    expect(frameDue(1020, 1000)).toBe(false);
  });
});

describe('the motion tables', () => {
  it("plays the dragon's table in the dragon's bone order", () => {
    expect(bonesOf(DRAGON_MOTION)).toEqual(['head', 'wingL', 'wingR', 'tail', 'chest', 'lift']);
  });

  // The dragon's idle as it shipped before motion became data (poseAt's closed form at d123050): the
  // head 1.5 deg on 6.2 s (phase 0.7) + 0.5 deg on 2.9 s; wingL 1.8 deg on 4.8 s (phase -0.9); wingR
  // -1.6 deg on 4.8 s (phase -1.15); the tail 2.4 deg on 3.7 s (phase 1.3) + 0.6 deg on 1.9 s; the breath
  // on 4.8 s, chest x 0.016 and y 0.008, lift 2.4 px. Each row: t, then at 1.5x the four turns (rad), the
  // chest's scales and the lift (px), from that formula.
  const OLD_POSE: [number, number, number, number, number, number, number, number][] = [
    [1.3, 0.03959721732, 0.03386024369, -0.02195480561, -0.03687216332, 1.023794677, 1.011897338, -3.569201501],
    [7.7, 0.02044365012, 0.01145312437, -0.01991656321, 0.06615142249, 0.9853897257, 0.9926948629, 2.191541144],
  ];
  it.each(OLD_POSE)('plays the dragon at %s s exactly as the old closed-form poseAt', (t, head, wingL, wingR, tail, sx, sy, lift) => {
    const near = (got: number, want: number, what: string) => expect(Math.abs(got - want), `${what} at ${t} s: ${got}, not ${want}`).toBeLessThanOrEqual(1e-6);
    for (const p of [poseFor(DRAGON_MOTION, t, PIVOTS), poseAt(t, PIVOTS)]) {
      [head, wingL, wingR, tail].forEach((want, b) => near(Math.atan2(p[b * 9 + 1], p[b * 9]), want, DRAGON_MOTION.rigid[b]));
      near(p[4 * 9], sx, 'chest x');
      near(p[4 * 9 + 4], sy, 'chest y');
      near(p[5 * 9 + 6], 0, 'lift x');
      near(p[5 * 9 + 7], lift, 'lift');
    }
  });
});

const spread = (waves: readonly Wave[]) => waves.reduce((s, w) => s + Math.abs(w.amp), 0);
const pivotsFor = (m: CreatureMotion): Pivots => Object.fromEntries(bonesOf(m).map((b, i) => [b, [300 + 40 * i, 200 + 90 * i] as const]));

describe.each(FOE_RIGS)('%s: the idle motion', (id) => {
  const m = FOE_MOTIONS[id];
  const pivots = pivotsFor(m);

  it('names four rigid bones, then the breath, and a motion (or none) for each rigid bone', () => {
    expect(bonesOf(m)).toHaveLength(6);
    expect(bonesOf(m).slice(4)).toEqual([...BREATH_BONES]);
    expect(new Set(m.rigid).size).toBe(4);
    expect(Object.keys(m.moves).sort()).toEqual([...m.rigid].sort());
  });

  it('is slow: every period is at least 1.5 s', () => {
    const periods = [m.breath.period, ...Object.values(m.moves).flatMap((mv) => (!mv ? [] : mv.kind === 'turn' ? mv.waves : [...mv.x, ...mv.y]).map((w) => w.period))];
    expect(Math.min(...periods)).toBeGreaterThanOrEqual(1.5);
  });

  it('stays within its amplitudes at 1.5x, and they are slight', () => {
    const peak = [0, 0, 0, 0];
    let chest = 0;
    let lift = 0;
    for (let t = 0; t < 120; t += 0.01) {
      const p = poseFor(m, t, pivots);
      m.rigid.forEach((b, i) => {
        const mv = m.moves[b];
        if (!mv) return;
        const v = mv.kind === 'turn' ? Math.abs(angle(p, i)) : Math.hypot(p[i * 9 + 6], p[i * 9 + 7]);
        peak[i] = Math.max(peak[i], v);
      });
      chest = Math.max(chest, Math.abs(p[4 * 9] - 1), Math.abs(p[4 * 9 + 4] - 1));
      lift = Math.max(lift, Math.abs(p[5 * 9 + 7]));
    }
    m.rigid.forEach((b, i) => {
      const mv = m.moves[b];
      if (!mv) {
        expect(peak[i], `${id} ${b}`).toBe(0);
        return;
      }
      const bound = AMPLITUDE * (mv.kind === 'turn' ? spread(mv.waves) : Math.hypot(spread(mv.x), spread(mv.y)));
      expect(peak[i], `${id} ${b}`).toBeLessThanOrEqual(bound + 1e-6);
      expect(peak[i], `${id} ${b} moves`).toBeGreaterThan(0.6 * bound);
      // Slight: a turn stays under 6 deg and a drift under 12 frame px at 1.5x.
      expect(peak[i], `${id} ${b} is slight`).toBeLessThanOrEqual(mv.kind === 'turn' ? 6 : 12);
    });
    expect(chest).toBeLessThanOrEqual(0.03 + 1e-9);
    expect(lift).toBeLessThanOrEqual(4.5 + 1e-9);
  });

  it('stands still at amplitude 0', () => {
    const p = poseFor(m, 7.7, pivots, 0);
    for (let b = 0; b < 6; b++) expect(Array.from(p.slice(b * 9, b * 9 + 9)).map((v) => (Math.abs(v) < 1e-9 ? 0 : v))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('never repeats on its breath period', () => {
    const a = poseFor(m, 1, pivots);
    const b = poseFor(m, 1 + m.breath.period, pivots);
    expect(m.rigid.some((_, i) => Math.abs(a[i * 9] - b[i * 9]) + Math.abs(a[i * 9 + 1] - b[i * 9 + 1]) + Math.abs(a[i * 9 + 6] - b[i * 9 + 6]) + Math.abs(a[i * 9 + 7] - b[i * 9 + 7]) > 1e-4)).toBe(true);
  });
});
