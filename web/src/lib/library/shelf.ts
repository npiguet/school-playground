// How the shelves and the desk talk about a text (playability #2, #5, #24): lengths instead of word
// counts, defences instead of « joué », who wrote it without repeating the title.
import { isProphecy } from '../dates';
import { levelIndex } from '../levels';
import { plural, rateText } from '../text/french';
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
  // Polish: "déjoués" dropped - at the tag's width (kit-tag-meta, 14 px) the full phrase wrapped to
  // a third line and ran past the cubby (shot a07, "Le chant des sirènes"); this fits two lines.
  return `${times} · ${rateText(h.best_catch_rate)} des pièges`;
}

/** A chapter's title « Livre — chapitre » (Alexandria's rolls, service.py) as the book and the
 *  chapter, each on its own line of the tag (re-review N2). A title without a spaced em dash, or
 *  with an empty side, stays whole. */
export function splitTitle(title: string): { book: string; chapter: string | null } {
  const at = title.indexOf(' — ');
  if (at >= 0) {
    const book = title.slice(0, at).trim();
    const chapter = title.slice(at + 3).trim();
    if (book && chapter) return { book, chapter };
  }
  return { book: title.trim(), chapter: null };
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

/** The desk's quill gauge: how many words, and how far from the ideal. Re-review N7: the server
 *  shelves a text of any length (schemas.py), so 80-200 words is the ideal, never a minimum - the
 *  owl (VOICES.desk), this label and the always-enabled submit agree. */
export function wordGauge(n: number): { label: string; state: 'short' | 'ok' | 'long'; fill: number } {
  const words = plural(n, 'mot', 'mots');
  const fill = Math.min(1, n / WORDS_MAX);
  const ideal = `${words} · l'idéal\u202f: ${WORDS_MIN} à ${WORDS_MAX}`;
  if (n < WORDS_MIN) return { label: ideal, state: 'short', fill };
  if (n <= WORDS_MAX) return { label: `${words} · parfait`, state: 'ok', fill };
  return { label: ideal, state: 'long', fill };
}

/** Read before a scroll's bare tense tag (« passé simple »), for assistive tech only. */
export const TENSES_PREFIX = 'temps de conjugaison\u202f: ';

/** What the pupitre and the lens say when the server moved the saved text above the hero's class
 *  because of its verb tenses (server app.nlp.tenses); null when it lands at her class or below. */
export function raisedLine(t: Pick<TextSummary, 'level' | 'tense_reason'>, heroLevel: string): string | null {
  if (!t.tense_reason || levelIndex(t.level) <= levelIndex(heroLevel)) return null;
  return `Ce texte est rangé en ${t.level} à cause de sa conjugaison\u202f: ${t.tense_reason}.`;
}

type ShelfText = Pick<TextSummary, 'id' | 'level' | 'title' | 'due_date'>;

const byLevelThenTitle = (a: ShelfText, b: ShelfText) =>
  levelIndex(a.level) - levelIndex(b.level) || a.title.localeCompare(b.title, 'fr');

/** The shelves' three sections, each text on one shelf only (immersion wave Task 8, fix round 1):
 *  the Oracle's prophecies (a due date not yet passed, soonest first), « Pour toi » (her class), and
 *  behind « Autres classes » every other class (`filter` « Tous ») or one class - minus whatever
 *  already lies on a shelf above, so choosing her own class or a prophecy's never repeats a scroll. */
export function shelfSections<T extends ShelfText>(
  texts: readonly T[],
  ownLevel: string,
  filter: string,
  today: Date = new Date(),
): { prophecies: T[]; own: T[]; others: T[] } {
  const prophecies = texts
    .filter((t) => isProphecy(t.due_date, today))
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  const shown = new Set(prophecies.map((t) => t.id));
  const own = texts.filter((t) => t.level === ownLevel && !shown.has(t.id)).sort(byLevelThenTitle);
  for (const t of own) shown.add(t.id);
  const others = texts
    .filter((t) => !shown.has(t.id) && (filter === 'Tous' ? t.level !== ownLevel : t.level === filter))
    .sort(byLevelThenTitle);
  return { prophecies, own, others };
}
