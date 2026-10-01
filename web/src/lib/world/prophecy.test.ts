import { describe, expect, it } from 'vitest';
import { prophecyBonus, prophecyWhen } from './prophecy';

// Re-review N6 / ruling W-f: the bonus is a tag on the prophecy strip, not a rule paragraph. The
// server pays it for a dictation finished strictly before the due date (sessions.py, xp.py x1.5).
describe('prophecyBonus', () => {
  const p = (due_date: string, days_left: number) => ({ text_id: 1, title: 'La dictée du jeudi', due_date, days_left });

  it('names the day when it falls within the week', () => {
    expect(prophecyBonus(p('2026-09-28', 2))).toBe("Défendue avant lundi\u202f: +50\u202f% d'XP");
    expect(prophecyBonus(p('2026-10-03', 6))).toBe("Défendue avant samedi\u202f: +50\u202f% d'XP");
  });

  it('says « son jour » when a weekday alone would be ambiguous (a week or more away)', () => {
    expect(prophecyBonus(p('2026-10-05', 7))).toBe("Défendue avant son jour\u202f: +50\u202f% d'XP");
    expect(prophecyBonus(p('2099-01-01', 26000))).toBe("Défendue avant son jour\u202f: +50\u202f% d'XP");
  });

  it('shows nothing on the day itself: the bonus is no longer on offer, and nothing shames her for it', () => {
    expect(prophecyBonus(p('2026-09-26', 0))).toBeNull();
  });
});

// Moved from the hub's tests (UI3b Task 7): the hub no longer shows the card, the wording guard stays.
describe('prophecyWhen', () => {
  it('says when a prophecy falls due in words', () => {
    expect([0, 1, 3].map(prophecyWhen)).toEqual(["aujourd'hui", 'demain', 'dans\u00a03\u00a0jours']);
  });
});
