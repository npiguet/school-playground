import { describe, expect, it } from 'vitest';
import { loopRegion } from './loop';

const meta = { samples: 60 * 44100, rate: 44100, priming: 1024 };

describe('the loop region (Ruling E9)', () => {
  it('loops the whole buffer when the browser dropped the encoder priming, or when the length is unknown', () => {
    expect(loopRegion(60, meta)).toEqual([0, 60]);
    expect(loopRegion(59.999, meta)).toEqual([0, 59.999]);
    expect(loopRegion(12.5, undefined)).toEqual([0, 12.5]);
  });

  // Lane A review #4: the real files' padding (Task 3's meta.gen.json). Only a buffer at least as long
  // as priming + audio has kept the priming; one that kept only the padding starts at 0.
  it.each([220, 564, 888])('reads the real files right whatever the browser kept (padding %i)', (padding) => {
    const rate = 44100;
    const m = { samples: 60 * rate, rate, priming: 1024 };
    const whole = (60 * rate + 1024 + padding) / rate;
    const [s1, l1] = loopRegion(whole, m);
    expect(s1).toBeCloseTo(1024 / rate, 9);
    expect(l1).toBeCloseTo(60, 9);
    expect(loopRegion((60 * rate + padding) / rate, m)).toEqual([0, 60]);
    expect(loopRegion(60, m)).toEqual([0, 60]);
    expect(loopRegion((60 * rate + 1024) / rate - 1e-5, m)[0]).toBeCloseTo(1024 / rate, 9);
  });

  it('skips the priming and stops before the padding when the browser kept them', () => {
    const [start, length] = loopRegion(60 + (1024 + 900) / 44100, meta);
    expect(start).toBeCloseTo(1024 / 44100, 6);
    expect(length).toBeCloseTo(60, 6);
  });
});
