import { describe, expect, it } from 'vitest';
import { de, longDate, plural } from './french';

describe('French wording helpers', () => {
  it('counts without a form plural (playability #10)', () => {
    expect(plural(2, 'quête', 'quêtes')).toBe('2 quêtes');
    expect(plural(1, 'quête', 'quêtes')).toBe('1 quête');
    expect(plural(0, 'ruse', 'ruses')).toBe('0 ruse');
    expect(plural(12, 'rouleau', 'rouleaux')).toBe('12 rouleaux');
  });

  it('elides « de » before a vowel or a mute h (playability #14)', () => {
    expect(de('Ariane')).toBe("d'Ariane");
    expect(de('Anne-Charlotte')).toBe("d'Anne-Charlotte");
    expect(de('Élise-Marguerite')).toBe("d'Élise-Marguerite");
    expect(de('Hugo')).toBe("d'Hugo");
    expect(de('Yves')).toBe("d'Yves");
    expect(de('Yann')).toBe('de Yann');
    expect(de('Jules')).toBe('de Jules');
    expect(de('  Zoé ')).toBe('de Zoé');
  });

  it('says a date as a person does, the year only when it is not this one (playability #19)', () => {
    const today = new Date(2026, 8, 25);
    expect(longDate('2026-09-28', today)).toBe('lundi 28 septembre');
    expect(longDate('2099-01-01', today)).toBe('jeudi 1er janvier 2099');
    expect(longDate('2035-06-30', today)).toBe('samedi 30 juin 2035');
    expect(longDate('2026-10-01T00:00:00', today)).toBe('jeudi 1er octobre');
  });
});
