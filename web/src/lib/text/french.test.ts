import { describe, expect, it } from 'vitest';
import { countWord, de, decimalFr, frenchSpacing, longDate, plural, thousands, weekdayOf } from './french';

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
    // B1 fix round 1: capital accents and ligatures, lowercase initials, a sounded h, no name.
    expect(de('Îlona')).toBe("d'Îlona");
    expect(de('Œdipe')).toBe("d'Œdipe");
    expect(de('Ôrélie')).toBe("d'Ôrélie");
    expect(de('ariane')).toBe("d'ariane");
    expect(de('hugo')).toBe("d'hugo");
    expect(de('jules')).toBe('de jules');
    expect(de('Harry')).toBe('de Harry');
    expect(de('Hannah-Rose')).toBe('de Hannah-Rose');
    expect(de('Hélène')).toBe("d'Hélène");
    expect(de('')).toBe('de');
    expect(de('   ')).toBe('de');
  });

  it('says a date as a person does, the year only when it is not this one (playability #19)', () => {
    const today = new Date(2026, 8, 25);
    expect(longDate('2026-09-28', today)).toBe('lundi 28 septembre');
    expect(longDate('2099-01-01', today)).toBe('jeudi 1er janvier 2099');
    expect(longDate('2035-06-30', today)).toBe('samedi 30 juin 2035');
    expect(longDate('2026-10-01T00:00:00', today)).toBe('jeudi 1er octobre');
    // B1 fix round 1: malformed input comes back unchanged.
    for (const bad of ['', 'demain', '2026-9-28', '2026-13-01', '2026-02-30', '2026-00-10']) expect(longDate(bad, today)).toBe(bad);
  });
});

describe('weekdayOf', () => {
  it('names the weekday of a real date, null otherwise', () => {
    expect(weekdayOf('2026-09-28')).toBe('lundi');
    expect(weekdayOf('2099-01-01')).toBe('jeudi');
    expect(weekdayOf('2026-10-04T00:00:00')).toBe('dimanche');
    for (const bad of ['', 'demain', '2026-02-30', '2026-13-01']) expect(weekdayOf(bad)).toBeNull();
  });
});

describe('frenchSpacing (Ruling E15)', () => {
  it('puts a narrow no-break space before « : ; ! ? » and inside guillemets', () => {
    expect(frenchSpacing('Hou ! Quoi ?! Voilà : « mot » ; fin')).toBe('Hou\u202f! Quoi\u202f?! Voilà\u202f: «\u202fmot\u202f»\u202f; fin');
  });
  it('replaces a no-break space too, and is idempotent', () => {
    const once = frenchSpacing('Vite\u00a0!');
    expect(once).toBe('Vite\u202f!');
    expect(frenchSpacing(once)).toBe(once);
  });
  it('leaves an unspaced colon alone (never invents a space)', () => {
    expect(frenchSpacing('l’idéal:80')).toBe('l’idéal:80');
  });
  it('groups thousands with a narrow no-break space (« 15 000 »)', () => {
    expect([0, 999, 1000, 41000, 1234567].map(thousands)).toEqual(['0', '999', '1\u202f000', '41\u202f000', '1\u202f234\u202f567']);
  });
  it('counts in words up to six, agreed with a feminine noun, then in digits', () => {
    expect([0, 1, 2, 6, 7, 12].map((n) => countWord(n))).toEqual(['zéro', 'un', 'deux', 'six', '7', '12']);
    expect([1, 3].map((n) => countWord(n, true))).toEqual(['une', 'trois']);
  });
  it('writes a decimal with a French comma, in a count too (a rules value may be 4.5)', () => {
    expect([4, 4.5, 0.25].map(decimalFr)).toEqual(['4', '4,5', '0,25']);
    expect(plural(4.5, 'faute', 'fautes')).toBe('4,5 fautes');
    expect(plural(1.5, 'faute', 'fautes')).toBe('1,5 faute');
  });
});
