import { describe, expect, it } from 'vitest';
import { historyLine, lengthOf, shelfSections, splitTitle, textByline, wordGauge, workByline } from './shelf';

describe('the shelves speak the camp, not the catalogue (playability #2, #5, #24)', () => {
  it('turns a word count into a scroll length', () => {
    expect([80, 110, 111, 160, 161, 230].map(lengthOf)).toEqual(['court', 'court', 'moyen', 'moyen', 'long', 'long']);
  });

  it('tells the history as defences', () => {
    expect(historyLine(null)).toBe('Jamais défendu');
    expect(historyLine({ times_played: 0, best_catch_rate: null } as never)).toBe('Jamais défendu');
    expect(historyLine({ times_played: 3, best_catch_rate: null } as never)).toBe('Défendu 3 fois');
    expect(historyLine({ times_played: 1, best_catch_rate: 0.916 } as never)).toBe('Défendu 1 fois · 92\u202f% des pièges');
  });

  it('names who wrote it, never the title again', () => {
    expect(textByline({ author: 'Victor Hugo', translator: null, source: 'online', added_by_name: null, credits: 'Victor Hugo, Les Misérables' })).toBe('Victor Hugo');
    expect(textByline({ author: 'Hans Christian Andersen', translator: 'David Soldi', source: 'online', added_by_name: null, credits: null })).toBe(
      'Hans Christian Andersen, trad. David Soldi',
    );
    expect(textByline({ author: null, translator: null, source: 'custom', added_by_name: 'Ariane', credits: null })).toBe('Ajouté par Ariane');
    expect(textByline({ author: null, translator: null, source: 'seed', added_by_name: null, credits: 'Les Muses de la Discorde, Textes originaux' })).toBe(
      'Les Muses de la Discorde, Textes originaux',
    );
    expect(workByline({ author: 'Charles Perrault', translator: null })).toBe('Charles Perrault');
    expect(workByline({ author: 'Lewis Carroll', translator: 'Henri Bué' })).toBe('Lewis Carroll, trad. Henri Bué');
  });

  // Re-review N7: the server takes a text of any length (schemas.py: body min_length=1), so 80-200 is
  // the ideal, not a rule - the owl, the gauge and the (enabled) submit say the same thing.
  it('measures a text against the ideal 80-200 words (the desk gauge)', () => {
    expect(wordGauge(13)).toEqual({ label: "13 mots · l'idéal\u202f: 80 à 200", state: 'short', fill: 13 / 200 });
    expect(wordGauge(1).label).toBe("1 mot · l'idéal\u202f: 80 à 200");
    expect(wordGauge(94)).toEqual({ label: '94 mots · parfait', state: 'ok', fill: 94 / 200 });
    expect(wordGauge(214)).toEqual({ label: "214 mots · l'idéal\u202f: 80 à 200", state: 'long', fill: 1 });
  });
});

describe('shelfSections: each scroll lies on one shelf only (Task 8 fix round 1)', () => {
  const today = new Date(2026, 8, 25);
  const t = (id: number, level: string, title: string, due_date: string | null = null) => ({ id, level, title, due_date });
  const texts = [
    t(1, '10H', 'Zéphyr'),
    t(2, '10H', 'Aurore'),
    t(3, '9H', 'Prophétie de neuvième', '2026-10-01'),
    t(4, '9H', 'Neuvième'),
    t(5, '8H', 'Huitième'),
    t(6, '10H', 'Passée', '2026-09-01'),
  ];
  const ids = (xs: { id: number }[]) => xs.map((x) => x.id);

  it('puts the prophecies first, then her class, then every other class (« Tous »)', () => {
    const s = shelfSections(texts, '10H', 'Tous', today);
    expect(ids(s.prophecies)).toEqual([3]);
    expect(ids(s.own)).toEqual([2, 6, 1]);
    expect(ids(s.others)).toEqual([5, 4]);
  });

  it('never repeats « Pour toi » when she chooses her own class', () => {
    expect(ids(shelfSections(texts, '10H', '10H', today).others)).toEqual([]);
  });

  it('never repeats a prophecy under its class', () => {
    expect(ids(shelfSections(texts, '10H', '9H', today).others)).toEqual([4]);
  });
});

// Re-review N2: a chapter title « Livre — chapitre » is split so the part that tells two chapters of
// one book apart is never the part a clamp cuts.
describe('splitTitle', () => {
  it('splits a book and its chapter at the first spaced em dash', () => {
    expect(splitTitle('Les Trois Mousquetaires — la lettre')).toEqual({ book: 'Les Trois Mousquetaires', chapter: 'la lettre' });
    expect(splitTitle('Contes — Le Petit Poucet — la forêt')).toEqual({ book: 'Contes', chapter: 'Le Petit Poucet — la forêt' });
  });

  it('keeps a plain title whole', () => {
    expect(splitTitle("L'île de Circé")).toEqual({ book: "L'île de Circé", chapter: null });
    expect(splitTitle('Arc-en-ciel—sans espaces')).toEqual({ book: 'Arc-en-ciel—sans espaces', chapter: null });
    expect(splitTitle(' — ')).toEqual({ book: '—', chapter: null });
  });
});
