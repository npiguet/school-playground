// French wording helpers (immersion wave): counts without « (s) », « de » elided before a vowel,
// dates as a person says them. Pure and deterministic - no Intl: Node's ICU and WebKit's disagree
// on fr-CH punctuation, and vitest runs in Node (Ruling W7).

/** A rate in words, « 75 % », or « — » when there was nothing to catch. The one percent
 *  formatter of the game (final review M1): a narrow no-break space before « % » (French
 *  typography), so the sign never wraps alone, wherever the rate is shown. */
export function rateText(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(100 * rate)} %`;
}

/** « 2 quêtes », « 1 quête », « 0 quête » (in French, fewer than two is singular). */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${Math.abs(n) < 2 ? one : many}`;
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
