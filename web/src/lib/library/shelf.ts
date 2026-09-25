// How the shelves and the desk talk about a text (playability #2, #5, #24): lengths instead of word
// counts, defences instead of « joué », who wrote it without repeating the title.
import { plural } from '../text/french';
import type { AlexandriaWork, TextSummary } from '../types';

export type Length = 'court' | 'moyen' | 'long';
export const WORDS_MIN = 80;
export const WORDS_MAX = 200;

/** A scroll's thickness on the shelf. */
export function lengthOf(words: number): Length {
  return words <= 110 ? 'court' : words <= 160 ? 'moyen' : 'long';
}

export function historyLine(h: TextSummary['history']): string {
  if (!h || h.times_played === 0) return 'Jamais défendu';
  const times = `Défendu ${h.times_played} fois`;
  if (h.best_catch_rate === null || h.best_catch_rate === undefined) return times;
  // A narrow no-break space before « % » (French typography): the sign never wraps alone.
  return `${times} · ${Math.round(h.best_catch_rate * 100)} % des pièges déjoués`;
}

/** Author (and translator); « Ajouté par X » for her own texts; the seed credits as a last resort. */
export function textByline(t: Pick<TextSummary, 'author' | 'translator' | 'source' | 'added_by_name' | 'credits'>): string {
  if (t.author) return t.translator ? `${t.author}, trad. ${t.translator}` : t.author;
  if (t.source === 'custom' && t.added_by_name) return `Ajouté par ${t.added_by_name}`;
  return t.credits ?? '';
}

export function workByline(w: Pick<AlexandriaWork, 'author' | 'translator'>): string {
  return w.translator ? `${w.author}, trad. ${w.translator}` : w.author;
}

/** The desk's quill gauge: how many words, and whether that is enough. */
export function wordGauge(n: number): { label: string; state: 'short' | 'ok' | 'long'; fill: number } {
  const words = plural(n, 'mot', 'mots');
  const fill = Math.min(1, n / WORDS_MAX);
  if (n < WORDS_MIN) return { label: `${words} · il en faut au moins ${WORDS_MIN}`, state: 'short', fill };
  if (n <= WORDS_MAX) return { label: `${words} · parfait`, state: 'ok', fill };
  return { label: `${words} · au plus ${WORDS_MAX}`, state: 'long', fill };
}
