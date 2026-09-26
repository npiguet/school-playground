import { describe, expect, it } from 'vitest';
import { loopRegion } from './loop';

const meta = { samples: 60 * 44100, rate: 44100, priming: 1024 };

describe('the loop region (Ruling E9)', () => {
  it('loops the whole buffer when the browser dropped the encoder priming, or when the length is unknown', () => {
    expect(loopRegion(60, meta)).toEqual([0, 60]);
    expect(loopRegion(59.999, meta)).toEqual([0, 59.999]);
    expect(loopRegion(12.5, undefined)).toEqual([0, 12.5]);
  });

  it('skips the priming and stops before the padding when the browser kept them', () => {
    const [start, length] = loopRegion(60 + (1024 + 900) / 44100, meta);
    expect(start).toBeCloseTo(1024 / 44100, 6);
    expect(length).toBeCloseTo(60, 6);
  });
});
