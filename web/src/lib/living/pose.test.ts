import { describe, expect, it } from 'vitest';
import { AMPLITUDE, frameDue, poseAt, type Pivots } from './pose';

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
