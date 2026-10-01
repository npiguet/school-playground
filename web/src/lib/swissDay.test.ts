import { describe, expect, it } from 'vitest';
import { swissDay } from './swissDay';

// Paces re-review: the e2e's Swiss local day, counted on the calendar, so a daylight-saving change
// between `now` and the day asked for never moves it a day. Europe/Zurich, 2026: summer time starts on
// 29 March (02:00 becomes 03:00), ends on 25 October (03:00 becomes 02:00).
describe('swissDay', () => {
  it('is the Swiss local date, not the UTC one', () => {
    // 00:05 on Monday 28 September in Zurich is still Sunday 27 in UTC.
    expect(swissDay(0, new Date('2026-09-27T22:05:00Z'))).toBe('2026-09-28');
    expect(swissDay(undefined, new Date('2026-09-27T21:55:00Z'))).toBe('2026-09-27');
  });

  it('counts days on the calendar across the spring change, back and forward', () => {
    // Zurich 30 March 00:30 (summer time): the day before is 29 March, not 28.
    const after = new Date('2026-03-29T22:30:00Z');
    expect(swissDay(0, after)).toBe('2026-03-30');
    expect(swissDay(1, after)).toBe('2026-03-29');
    expect(swissDay(2, after)).toBe('2026-03-28');
    // Zurich 28 March 23:30 (winter time): the day after is 29 March, not 30.
    const before = new Date('2026-03-28T22:30:00Z');
    expect(swissDay(0, before)).toBe('2026-03-28');
    expect(swissDay(-1, before)).toBe('2026-03-29');
    expect(swissDay(-2, before)).toBe('2026-03-30');
  });

  it('counts days on the calendar across the autumn change, back and forward', () => {
    // Zurich 25 October 23:30 (winter time again): the day before is 24 October, not 25.
    const after = new Date('2026-10-25T22:30:00Z');
    expect(swissDay(0, after)).toBe('2026-10-25');
    expect(swissDay(1, after)).toBe('2026-10-24');
    // Zurich 25 October 00:30 (still summer time): the day after is 26 October, not 25.
    const before = new Date('2026-10-24T22:30:00Z');
    expect(swissDay(0, before)).toBe('2026-10-25');
    expect(swissDay(-1, before)).toBe('2026-10-26');
  });

  it('crosses months and years', () => {
    expect(swissDay(1, new Date('2026-03-01T10:00:00Z'))).toBe('2026-02-28');
    expect(swissDay(-1, new Date('2026-12-31T10:00:00Z'))).toBe('2027-01-01');
  });
});
