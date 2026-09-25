import { describe, expect, it } from 'vitest';
import { historyLine, lengthOf, shelfSections, textByline, wordGauge, workByline } from './shelf';

describe('the shelves speak the camp, not the catalogue (playability #2, #5, #24)', () => {
  it('turns a word count into a scroll length', () => {
    expect([80, 110, 111, 160, 161, 230].map(lengthOf)).toEqual(['court', 'court', 'moyen', 'moyen', 'long', 'long']);
  });

  it('tells the history as defences', () => {
    expect(historyLine(null)).toBe('Jamais défendu');
    expect(historyLine({ times_played: 0, best_catch_rate: null } as never)).toBe('Jamais défendu');
    expect(historyLine({ times_played: 3, best_catch_rate: null } as never)).toBe('Défendu 3 fois');
    expect(historyLine({ times_played: 1, best_catch_rate: 0.916 } as never)).toBe('Défendu 1 fois · 92 % des pièges déjoués');
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

  it('measures a text against the 80-200 words it needs (the desk gauge)', () => {
    expect(wordGauge(13)).toEqual({ label: '13 mots · il en faut au moins 80', state: 'short', fill: 13 / 200 });
    expect(wordGauge(1).label).toBe('1 mot · il en faut au moins 80');
    expect(wordGauge(94)).toEqual({ label: '94 mots · parfait', state: 'ok', fill: 94 / 200 });
    expect(wordGauge(214)).toEqual({ label: '214 mots · au plus 200', state: 'long', fill: 1 });
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
