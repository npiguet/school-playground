import { describe, expect, it } from 'vitest';
import { historyLine, lengthOf, textByline, wordGauge, workByline } from './shelf';

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
