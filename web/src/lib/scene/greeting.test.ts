import { beforeEach, describe, expect, it } from 'vitest';
import { markGreeted, markGreetedKey, resetGreetings, shouldGreet, shouldGreetKey } from './greeting';

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

describe('keyed place greetings (UI3 Ruling A9)', () => {
  it('greets once per key per page load, and a reload forgets it', () => {
    resetGreetings();
    expect(shouldGreetKey('library:3')).toBe(true);
    markGreetedKey('library:3');
    expect(shouldGreetKey('library:3')).toBe(false);
    expect(shouldGreetKey('library:4')).toBe(true);
    expect(shouldGreetKey('delphi:3')).toBe(true);
    resetGreetings();
    expect(shouldGreetKey('library:3')).toBe(true);
  });
});
