// French wording helpers (immersion wave): counts without « (s) », « de » elided before a vowel,
// dates as a person says them. Pure and deterministic - no Intl: Node's ICU and WebKit's disagree
// on fr-CH punctuation, and vitest runs in Node (Ruling W7).

/** A rate in words, « 75 % », or « — » when there was nothing to catch. The one percent
 *  formatter of the game (final review M1): a narrow no-break space before « % » (French
 *  typography), so the sign never wraps alone, wherever the rate is shown. */
export function rateText(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(100 * rate)}\u202f%`;
}

/** French typography (Ruling E15): a narrow no-break space (U+202F) before « : ; ! ? » and inside
 *  « guillemets », replacing a plain or no-break space already there, so a line never wraps a lone
 *  « ! » onto the next line. Never adds a space where there was none. Idempotent. */
export function frenchSpacing(text: string): string {
  return text.replace(/[ \u00a0]+([:;!?»])/g, '\u202f$1').replace(/«[ \u00a0]+/g, '«\u202f');
}

/** A count with its thousands grouped by a narrow no-break space, as French typography wants (« 15 000 »). */
export function thousands(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

/** A number as French writes it: a decimal comma (« 4,5 »), a whole number as it is. The rules
 *  file may hold a decimal (fight_max_per_100), which would otherwise print « 4.5 ». */
export function decimalFr(n: number): string {
  return String(n).replace('.', ',');
}

/** « 2 quêtes », « 1 quête », « 0 quête », « 4,5 fautes » (in French, fewer than two is singular). */
export function plural(n: number, one: string, many: string): string {
  return `${decimalFr(n)} ${Math.abs(n) < 2 ? one : many}`;
}

const COUNT_WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];

/** A small count in words (« un », « deux » … « six »), digits past it; « une » before a feminine
 *  noun (« une belle copie »). The one table the camp's lines count with. */
export function countWord(n: number, feminine = false): string {
  if (n === 1 && feminine) return 'une';
  return Number.isInteger(n) && n >= 0 && n < COUNT_WORDS.length ? COUNT_WORDS[n] : String(n);
}

const VOWEL_OR_H = /^[aeiouàâäéèêëîïôöùûüœæh]/i;
// A leading y elides when it sounds like a vowel (« Yves », « Ysaline »), not before one (« Yann »).
const Y_AS_VOWEL = /^y[^aeiouyàâäéèêëîïôöùûü]/i;

// First names whose h is sounded (foreign names; French first names mostly have a mute h, « d'Hugo »,
// « d'Hélène »): no elision, « de Harry ». Kept short on purpose - extend it when a hero needs it.
const SOUNDED_H = new Set(['hannah', 'hans', 'harry', 'heidi']);

/** « de » before a name, elided before a vowel or a mute h: « d'Ariane », « d'Hugo », « de Yann »,
 *  « de Harry ». An empty name gives a bare « de ». */
export function de(name: string): string {
  const s = name.trim();
  if (!s) return 'de';
  if (SOUNDED_H.has(s.split(/[\s-]/)[0].toLowerCase())) return `de ${s}`;
  return VOWEL_OR_H.test(s) || Y_AS_VOWEL.test(s) ? `d'${s}` : `de ${s}`;
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** The weekday of a YYYY-MM-DD date (« lundi »), or null when it is not a real date. */
export function weekdayOf(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return WEEKDAYS[date.getUTCDay()];
}

/** « 29 septembre 2026 », « 1er octobre 2026 », always with the year; null when `iso` is not a real
 *  YYYY-MM-DD date. */
export function dayMonthYear(iso: string): string | null {
  if (!weekdayOf(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
}

/** « lundi 28 septembre », « jeudi 1er janvier 2099 »: the year only when it is not this one. Input
 *  that is not a real YYYY-MM-DD date comes back as it was, never « undefined NaN ». */
export function longDate(iso: string, today: Date = new Date()): string {
  const weekday = weekdayOf(iso);
  if (!weekday) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const day = d === 1 ? '1er' : String(d);
  const year = y === today.getFullYear() ? '' : ` ${y}`;
  return `${weekday} ${day} ${MONTHS[m - 1]}${year}`;
}
