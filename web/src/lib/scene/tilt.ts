// Device-tilt parallax (scenes UI spec §4 "on pointer drag / device tilt where permitted", UI3
// Ruling A5). `deviceorientation` gives beta (front-back) and gamma (left-right) in the device's
// portrait frame; the screen's axes depend on how the iPad is held (screen.orientation.angle).
// The first reading is the resting pose; ±TILT_RANGE degrees from it is full deflection.
export const TILT_RANGE = 15;

export interface TiltSample {
  beta: number;
  gamma: number;
}

/** Tilt along the screen's own x (right side down = +) and y (top edge away = +) axes. */
export function screenTilt(s: TiltSample, angle: number): { x: number; y: number } {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  if (a === 90) return { x: s.beta, y: -s.gamma + 0 };
  if (a === 180) return { x: -s.gamma + 0, y: -s.beta + 0 };
  if (a === 270) return { x: -s.beta + 0, y: s.gamma };
  return { x: s.gamma, y: s.beta };
}

export function tiltToNorm(s: TiltSample, base: TiltSample, angle: number, range = TILT_RANGE): { nx: number; ny: number } {
  const now = screenTilt(s, angle);
  const rest = screenTilt(base, angle);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v)) + 0;
  return { nx: clamp((now.x - rest.x) / range), ny: clamp((now.y - rest.y) / range) };
}
