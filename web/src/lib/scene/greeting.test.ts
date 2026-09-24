import { beforeEach, describe, expect, it } from 'vitest';
import { markGreeted, resetGreetings, shouldGreet } from './greeting';

describe('greet once per profile per page load (Ruling 10)', () => {
  beforeEach(() => resetGreetings());

  it('greets each profile once', () => {
    expect(shouldGreet(1)).toBe(true);
    markGreeted(1);
    expect(shouldGreet(1)).toBe(false);
    expect(shouldGreet(2)).toBe(true);
  });

  it('forgets on reset (a new page load)', () => {
    markGreeted(1);
    resetGreetings();
    expect(shouldGreet(1)).toBe(true);
  });
});
