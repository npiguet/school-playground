// Ambient particles for the FxCanvas layer (scenes UI spec §2.1 "a small canvas FX layer"):
// embers rising from the camp fire, slow dust motes. Pure simulation; the component draws.
import type { FxPreset } from './types';

export type AmbientPreset = Exclude<FxPreset, 'none'>;

export interface Mote {
  x: number;
  y: number;
  /** px per second */
  vx: number;
  vy: number;
  /** ms */
  age: number;
  life: number;
  size: number;
  color: string;
}

export const FX_COUNTS: Record<AmbientPreset, number> = { embers: 26, dust: 18 };

// Gold and bronze tones only (kit.css `--bronze-light`, app.css `--gold`/`--gold-light`/`--bronze-ink`):
// per plan Ruling P8d, orange (`--orange: #e07b2a`) is reserved for Éris and never appears here;
// never a red either (parent spec "orange rather than red").
const COLORS: Record<AmbientPreset, string[]> = {
  embers: ['#f1dc9a', '#c89450', '#c9a227'],
  dust: ['#fff7e6', '#f1dc9a'],
};

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

/** `scatter` spreads initial ages so the first frame isn't a synchronised burst. */
export function spawnMote(preset: AmbientPreset, w: number, h: number, rand: () => number, scatter = false): Mote {
  if (preset === 'embers') {
    return {
      x: rand() * w,
      y: h * (0.75 + rand() * 0.25),
      vx: (rand() - 0.5) * 12,
      vy: -(18 + rand() * 30),
      age: scatter ? rand() * 2500 : 0,
      life: 2500 + rand() * 2500,
      size: 1 + rand() * 1.8,
      color: pick(COLORS.embers, rand),
    };
  }
  return {
    x: rand() * w,
    y: rand() * h,
    vx: (rand() - 0.5) * 6,
    vy: (rand() - 0.5) * 4,
    age: scatter ? rand() * 4000 : 0,
    life: 4000 + rand() * 4000,
    size: 0.8 + rand() * 1.2,
    color: pick(COLORS.dust, rand),
  };
}

export function stepMotes(
  motes: Mote[],
  preset: AmbientPreset,
  w: number,
  h: number,
  dtMs: number,
  rand: () => number,
): Mote[] {
  const dt = dtMs / 1000;
  return motes.map((m) => {
    const age = m.age + dtMs;
    if (age >= m.life) return spawnMote(preset, w, h, rand);
    return { ...m, age, x: m.x + m.vx * dt, y: m.y + m.vy * dt };
  });
}

export function moteAlpha(m: Mote): number {
  const t = m.age / m.life;
  return Math.max(0, Math.min(1, t < 0.2 ? t / 0.2 : (1 - t) / 0.8));
}
