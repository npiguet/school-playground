// The living dragon's idle motion (spec 2026-10-02 living dragon, "What she sees"): breath 4.8 s; the
// wings follow it with a lag, left and right slightly apart; the head on its own 6.2 s sway with a
// 2.9 s nod; the tail on 3.7 s + 1.9 s. No common period on purpose: a beat that never quite repeats
// reads as alive rather than as a looping gif. The base values are the spike's 1x; the game plays
// them at AMPLITUDE (the user's choice, 1.5x).
import { BONES, rotAbout, scaleAbout, translate, type Affine, type Bone, type Point } from './skin';

export const AMPLITUDE = 1.5;
export type Pivots = Record<Bone, Point>;

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

/** The six bones at time `t` (s): six column-major mat3 in BONES order. */
export function poseAt(t: number, pivots: Pivots, amplitude: number = AMPLITUDE): Float32Array {
  const a = amplitude;
  const breath = Math.sin((TAU * t) / 4.8);
  const m: Record<Bone, Affine> = {
    head: rotAbout(pivots.head, a * (1.5 * DEG * Math.sin((TAU * t) / 6.2 + 0.7) + 0.5 * DEG * Math.sin((TAU * t) / 2.9))),
    wingL: rotAbout(pivots.wingL, a * 1.8 * DEG * Math.sin((TAU * t) / 4.8 - 0.9)),
    wingR: rotAbout(pivots.wingR, -a * 1.6 * DEG * Math.sin((TAU * t) / 4.8 - 1.15)),
    tail: rotAbout(pivots.tail, a * (2.4 * DEG * Math.sin((TAU * t) / 3.7 + 1.3) + 0.6 * DEG * Math.sin((TAU * t) / 1.9))),
    chest: scaleAbout(pivots.chest, 1 + 0.016 * a * breath, 1 + 0.008 * a * breath),
    lift: translate(0, -2.4 * a * breath),
  };
  return Float32Array.from(BONES.flatMap((b) => m[b]));
}

export const FPS = 30;

/** Whether a frame is due at `now` (ms) after the last drawn at `last`, at `fps`; 4 ms of rAF jitter
 *  still counts, so a 60 Hz display draws one frame in two. */
export function frameDue(now: number, last: number | null, fps: number = FPS): boolean {
  return last === null || now - last >= 1000 / fps - 4;
}
