import { describe, expect, it } from 'vitest';
import { PROPHECY_SOON_DAYS, prophecyBonus, prophecySoon, prophecyWhen } from './prophecy';
import type { CampResponse } from './types';

// Re-review N6 / ruling W-f: the bonus is a tag on the prophecy strip, not a rule paragraph. The
// server pays it for a dictation finished strictly before the due date (sessions.py, xp.py).
describe('prophecyBonus', () => {
  const p = (due_date: string, days_left: number) => ({ text_id: 1, title: 'La dictée du jeudi', due_date, days_left });

  it('names the day when it falls within the week', () => {
    expect(prophecyBonus(p('2026-09-28', 2), 0.5)).toBe("Défendue avant lundi\u202f: +50\u202f% d'XP");
    expect(prophecyBonus(p('2026-10-03', 6), 0.5)).toBe("Défendue avant samedi\u202f: +50\u202f% d'XP");
  });

  it('says « son jour » when a weekday alone would be ambiguous (a week or more away)', () => {
    expect(prophecyBonus(p('2026-10-05', 7), 0.5)).toBe("Défendue avant son jour\u202f: +50\u202f% d'XP");
    expect(prophecyBonus(p('2099-01-01', 26000), 0.5)).toBe("Défendue avant son jour\u202f: +50\u202f% d'XP");
  });

  it('shows nothing on the day itself: the bonus is no longer on offer, and nothing shames her for it', () => {
    expect(prophecyBonus(p('2026-09-26', 0), 0.5)).toBeNull();
  });

  it('prints the served bonus, and no figure before the catalogue or when the rules set it to 0', () => {
    expect(prophecyBonus(p('2026-09-28', 2), 0.3)).toBe("Défendue avant lundi\u202f: +30\u202f% d'XP");
    expect(prophecyBonus(p('2026-09-28', 2), null)).toBeNull();
    expect(prophecyBonus(p('2026-09-28', 2), 0)).toBeNull();
  });
});

// Moved from the hub's tests (UI3b Task 7): the hub no longer shows the card, the wording guard stays.
describe('prophecyWhen', () => {
  it('says when a prophecy falls due in words', () => {
    expect([0, 1, 3].map(prophecyWhen)).toEqual(["aujourd'hui", 'demain', 'dans\u00a03\u00a0jours']);
  });
});

// Final review M3: the week rule lives in one place, read by nextStep, whatNext and the camp's caption.
describe('prophecySoon', () => {
  const camp = (...days: number[]) =>
    ({
      prophecies: days.map((d, i) => ({ text_id: i + 1, title: `T${i}`, due_date: `2099-01-${String(d + 1).padStart(2, '0')}`, days_left: d })),
    }) as unknown as CampResponse;

  it('is the nearest prophecy when it falls due within the week, today included', () => {
    expect(PROPHECY_SOON_DAYS).toBe(7);
    expect(prophecySoon(camp(9, 7))?.days_left).toBe(7);
    expect(prophecySoon(camp(0))?.days_left).toBe(0);
  });

  it('is null further off, or with no prophecy', () => {
    expect(prophecySoon(camp(8))).toBeNull();
    expect(prophecySoon(camp())).toBeNull();
  });
});
