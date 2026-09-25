// French wording helpers (immersion wave): counts without « (s) », « de » elided before a vowel,
// dates as a person says them. Pure and deterministic - no Intl: Node's ICU and WebKit's disagree
// on fr-CH punctuation, and vitest runs in Node (Ruling W7).

/** « 2 quêtes », « 1 quête », « 0 quête » (in French, fewer than two is singular). */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${Math.abs(n) < 2 ? one : many}`;
}

const VOWEL_OR_H = /^[aeiouàâäéèêëîïôöùûüœæh]/i;
// A leading y elides when it sounds like a vowel (« Yves », « Ysaline »), not before one (« Yann »).
const Y_AS_VOWEL = /^y[^aeiouyàâäéèêëîïôöùûü]/i;

/** « de » before a name, elided before a vowel or a mute h: « d'Ariane », « d'Hugo », « de Yann ». */
export function de(name: string): string {
  const s = name.trim();
  return VOWEL_OR_H.test(s) || Y_AS_VOWEL.test(s) ? `d'${s}` : `de ${s}`;
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « lundi 28 septembre », « jeudi 1er janvier 2099 »: the year only when it is not this one. */
export function longDate(iso: string, today: Date = new Date()): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const day = d === 1 ? '1er' : String(d);
  const year = y === today.getFullYear() ? '' : ` ${y}`;
  return `${weekday} ${day} ${MONTHS[m - 1]}${year}`;
}
