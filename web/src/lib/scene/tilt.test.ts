import { describe, expect, it } from 'vitest';
import { TILT_RANGE, screenTilt, tiltToNorm } from './tilt';

const rest = { beta: 40, gamma: 5 };

describe('device tilt (UI3 Ruling A5)', () => {
  it('maps the device axes onto the screen axes for each orientation', () => {
    const s = { beta: 10, gamma: 3 };
    expect(screenTilt(s, 0)).toEqual({ x: 3, y: 10 });
    expect(screenTilt(s, 90)).toEqual({ x: 10, y: -3 });
    expect(screenTilt(s, 180)).toEqual({ x: -3, y: -10 });
    expect(screenTilt(s, 270)).toEqual({ x: -10, y: 3 });
    expect(screenTilt(s, -90)).toEqual({ x: -10, y: 3 });
  });

  it('measures from the resting pose and reaches full deflection at the range', () => {
    expect(tiltToNorm(rest, rest, 90)).toEqual({ nx: 0, ny: 0 });
    expect(tiltToNorm({ beta: 40 + TILT_RANGE, gamma: 5 }, rest, 90)).toEqual({ nx: 1, ny: 0 });
    expect(tiltToNorm({ beta: 40 - TILT_RANGE / 2, gamma: 5 }, rest, 90)).toEqual({ nx: -0.5, ny: 0 });
    expect(tiltToNorm({ beta: 40, gamma: 5 + TILT_RANGE }, rest, 90)).toEqual({ nx: 0, ny: -1 });
  });

  it('clamps to [-1, 1]', () => {
    expect(tiltToNorm({ beta: 120, gamma: -80 }, rest, 0)).toEqual({ nx: -1, ny: 1 });
  });
});
