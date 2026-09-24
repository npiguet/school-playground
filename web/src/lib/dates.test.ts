import { describe, it, expect } from 'vitest';
import { formatSwissDate, isProphecy, todayIso } from './dates';

describe('dates', () => {
  it('formats Swiss style', () => expect(formatSwissDate('2026-10-03')).toBe('03.10.2026'));
  it('todayIso is local YYYY-MM-DD', () => expect(todayIso(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24'));
  it('prophecy while the due date has not passed', () => {
    const today = new Date(2026, 8, 24);
    expect(isProphecy('2026-09-24', today)).toBe(true);
    expect(isProphecy('2026-09-25', today)).toBe(true);
    expect(isProphecy('2026-09-23', today)).toBe(false);
    expect(isProphecy(null, today)).toBe(false);
  });
});
