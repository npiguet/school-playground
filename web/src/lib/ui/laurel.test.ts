import { describe, expect, it } from 'vitest';
import { LAUREL_LEAVES, laurelLeaves } from './laurel';

describe('laurelLeaves', () => {
  it('lights one leaf per tenth of the way to the next stage, rounding down', () => {
    expect(LAUREL_LEAVES).toBe(10);
    expect(laurelLeaves(0, 150)).toBe(0);
    expect(laurelLeaves(75, 150)).toBe(5);
    expect(laurelLeaves(149, 150)).toBe(9);
    expect(laurelLeaves(150, 150)).toBe(10);
  });
  it('clamps out-of-range values', () => {
    expect(laurelLeaves(-5, 150)).toBe(0);
    expect(laurelLeaves(400, 150)).toBe(10);
  });
  it('shows a full laurel when there is no next stage (max <= 0)', () => {
    expect(laurelLeaves(1, 0)).toBe(10);
  });
});
