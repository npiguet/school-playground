import { beforeEach, describe, expect, it } from 'vitest';
import { greetKey, markGreeted, resetGreetings, shouldGreet } from './greeting';

describe('every place greets once per hero per page load (Ruling 10, UI3 Ruling A9)', () => {
  beforeEach(() => resetGreetings());

  it('keys a greeting by place and hero', () => {
    expect(greetKey('camp', 3)).toBe('camp:3');
    expect(greetKey('library', 3)).toBe('library:3');
  });

  it('greets once per key', () => {
    expect(shouldGreet('library:3')).toBe(true);
    markGreeted('library:3');
    expect(shouldGreet('library:3')).toBe(false);
    expect(shouldGreet('library:4')).toBe(true);
    expect(shouldGreet('delphi:3')).toBe(true);
    expect(shouldGreet('camp:3')).toBe(true);
  });

  it('forgets on reset (a new page load)', () => {
    markGreeted('camp:1');
    resetGreetings();
    expect(shouldGreet('camp:1')).toBe(true);
  });
});
