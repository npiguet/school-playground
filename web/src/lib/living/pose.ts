// The living figures' idle motion (spec 2026-10-02 living dragon, "What she sees"; spec 2026-10-03
// living battle, plan Ruling B4): a creature's motion is data. Each rigid bone turns about its pivot
// (degrees) or drifts (frame px), as a sum of sine waves; the breath scales the chest and lifts the body.
// No common period on purpose: a beat that never quite repeats reads as alive rather than as a looping
// gif. The dragon's table is the spike's 1x (breath 4.8 s; the wings follow it with a lag, left and
// right slightly apart; the head on its own 6.2 s sway with a 2.9 s nod; the tail on 3.7 s + 1.9 s);
// the foes' tables are in foes.ts. The game plays them at AMPLITUDE (the user's choice, 1.5x).
import { SLOTS, rotAbout, scaleAbout, translate, type Affine, type Point } from './skin';

export const AMPLITUDE = 1.5;
export type Pivots = Record<string, Point>;

export interface Wave {
  readonly amp: number;
  /** Seconds. */
  readonly period: number;
  /** Radians. */
  readonly phase: number;
}

/** `turn`: degrees about the bone's pivot; `drift`: frame px. */
export type BoneMotion = { readonly kind: 'turn'; readonly waves: readonly Wave[] } | { readonly kind: 'drift'; readonly x: readonly Wave[]; readonly y: readonly Wave[] };

export interface Breath {
  readonly period: number;
  /** The chest's scale at full breath, minus one, across and down. */
  readonly sx: number;
  readonly sy: number;
  /** Frame px the body rises at full breath. */
  readonly lift: number;
}

export interface CreatureMotion {
  /** Slots 0-3, in the rig's order (tools/art/rig.json's key order). */
  readonly rigid: readonly [string, string, string, string];
  /** Each rigid bone's motion; null: a bone with a pivot and nothing to move. */
  readonly moves: Readonly<Record<string, BoneMotion | null>>;
  readonly breath: Breath;
}

export const BREATH_BONES = ['chest', 'lift'] as const;

/** The six bone names of a creature, in slot order. */
export function bonesOf(m: CreatureMotion): readonly string[] {
  return [...m.rigid, ...BREATH_BONES];
}

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const REST: Affine = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function waveSum(waves: readonly Wave[], t: number): number {
  let s = 0;
  for (const w of waves) s += w.amp * Math.sin((TAU * t) / w.period + w.phase);
  return s;
}

/** The six bones at time `t` (s): six column-major mat3 in slot order. */
export function poseFor(m: CreatureMotion, t: number, pivots: Pivots, amplitude: number = AMPLITUDE): Float32Array {
  const a = amplitude;
  const out = new Float32Array(SLOTS * 9);
  m.rigid.forEach((bone, i) => {
    const mv = m.moves[bone];
    const mat = !mv ? REST : mv.kind === 'turn' ? rotAbout(pivots[bone], a * DEG * waveSum(mv.waves, t)) : translate(a * waveSum(mv.x, t), a * waveSum(mv.y, t));
    out.set(mat, i * 9);
  });
  const breath = Math.sin((TAU * t) / m.breath.period);
  out.set(scaleAbout(pivots.chest, 1 + m.breath.sx * a * breath, 1 + m.breath.sy * a * breath), 4 * 9);
  out.set(translate(0, -m.breath.lift * a * breath), 5 * 9);
  return out;
}

export const DRAGON_MOTION: CreatureMotion = {
  rigid: ['head', 'wingL', 'wingR', 'tail'],
  moves: {
    head: { kind: 'turn', waves: [{ amp: 1.5, period: 6.2, phase: 0.7 }, { amp: 0.5, period: 2.9, phase: 0 }] },
    wingL: { kind: 'turn', waves: [{ amp: 1.8, period: 4.8, phase: -0.9 }] },
    wingR: { kind: 'turn', waves: [{ amp: -1.6, period: 4.8, phase: -1.15 }] },
    tail: { kind: 'turn', waves: [{ amp: 2.4, period: 3.7, phase: 1.3 }, { amp: 0.6, period: 1.9, phase: 0 }] },
  },
  breath: { period: 4.8, sx: 0.016, sy: 0.008, lift: 2.4 },
};

/** The dragon's six bones at time `t` (s). */
export function poseAt(t: number, pivots: Pivots, amplitude: number = AMPLITUDE): Float32Array {
  return poseFor(DRAGON_MOTION, t, pivots, amplitude);
}

export const FPS = 30;

/** Whether a frame is due at `now` (ms) after the last drawn at `last`, at `fps`; 4 ms of rAF jitter
 *  still counts, so a 60 Hz display draws one frame in two. */
export function frameDue(now: number, last: number | null, fps: number = FPS): boolean {
  return last === null || now - last >= 1000 / fps - 4;
}
