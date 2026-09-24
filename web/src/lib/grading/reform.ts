// 1990 spelling-reform acceptance (spec §5 SP2, plan decision 5): both the traditional and the
// reformed spelling grade as correct. `reformCanon` maps a normalised word (already through
// normalizeWord) onto its traditional spelling so the tokenizer's `norm` is reform-canonical;
// explanations still always quote the reference text as written (`Token.text` is untouched).
import table from '@content/reform1990.json';

interface ReformTable {
  version: number;
  pairs: [string, string][];
  eler_eter_stems: string[];
  circumflex_protected: string[];
}

const data = table as ReformTable;

// reform spelling -> traditional spelling, plus traditional -> itself so a lookup always
// resolves to the canonical (traditional) form regardless of which variant was typed.
const toTraditional = new Map<string, string>();
for (const [traditional, reform] of data.pairs) {
  toTraditional.set(reform, traditional);
  toTraditional.set(traditional, traditional);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ElerRule {
  re: RegExp;
  replacement: string;
}

// -eler/-eter verbs: the reform spells the mute-e-triggered sound with a grave accent (il
// ruissèle) instead of doubling the consonant (il ruisselle). `eler_eter_stems` are infinitive
// stems minus "er"; the last letter is the consonant the traditional spelling doubles.
const ELER_ENDINGS = '(e|es|ent|era|eras|erai|erons|erez|eront|erais|erait|eraient)';

const elerRegexes: ElerRule[] = data.eler_eter_stems.map((stem) => {
  const c = stem.slice(-1);
  const b = stem.slice(0, -1);
  const accented = b.replace(/e$/, 'è');
  return {
    re: new RegExp(`^${escapeRegExp(accented)}${c}${ELER_ENDINGS}$`),
    replacement: `${b}${c}${c}$1`,
  };
});

// Words where the circumflex on i/u is kept because dropping it would collide with an unrelated
// word (dû/du, mûr/mur, sûr/sur, jeûne/jeune, croît/croît family, fût/fut — see fix round 1:
// "fût" moved here from a code-level addition since it's a per-word ambiguity, not a productive
// verb-tense pattern).
const CIRCUMFLEX_PROTECTED = new Set(data.circumflex_protected);

// Fix round 1, CRITICAL 1: common nouns that happen to end in the same letters as a protected
// verb tense (see CIRCUMFLEX_KEEP_RE below) but must still lose the circumflex under the reform.
const CIRCUMFLEX_STRIP_NOUNS = new Set(['coût', 'goût', 'août', 'dégoût', 'ragoût', 'moût', 'affût', 'surcoût', 'gît']);

// Verb-tense endings that keep the circumflex under the reform regardless of which specific verb:
// 1st/2nd person plural of the simple past ("-îmes"/"-ûmes", "-îtes"/"-ûtes"), the venir/tenir
// family's irregular 3rd singular ("-înt"), and the 3rd singular imperfect subjunctive
// ("-ît"/"-ût", e.g. qu'il fît/pût/dût/prît/sût/vît/mît/reçût/voulût/finît/partît/eût) — except
// when the word ends in "-aît"/"-oît" (connaît, plaît, naît, paraît, accroît: present-tense
// indicative forms, not the subjunctive, so they DO lose the circumflex). "-ût" alone is also
// kept in general (dût, eût, ...), with CIRCUMFLEX_STRIP_NOUNS above overriding it for ordinary
// nouns that happen to end the same way (coût, goût, août, ...).
const CIRCUMFLEX_KEEP_RE = /[îû](mes|tes)$|[îû]nt$|[^ao]ît$|ût$/;

export function reformCanon(norm: string): string {
  const explicit = toTraditional.get(norm);
  if (explicit !== undefined) return explicit;
  // Fix round 1, IMPORTANT 3: an inflected plural of an explicit pair (either spelling) is also
  // accepted, e.g. "évènements"/"événements", "ognons"/"oignons", "aigües"/"aiguës".
  if (norm.length > 1 && (norm.endsWith('s') || norm.endsWith('x'))) {
    const suffix = norm.slice(-1);
    const stemTraditional = toTraditional.get(norm.slice(0, -1));
    if (stemTraditional !== undefined) return stemTraditional + suffix;
  }
  for (const { re, replacement } of elerRegexes) {
    if (re.test(norm)) return norm.replace(re, replacement);
  }
  if (!CIRCUMFLEX_STRIP_NOUNS.has(norm) && (CIRCUMFLEX_PROTECTED.has(norm) || CIRCUMFLEX_KEEP_RE.test(norm))) {
    return norm;
  }
  return norm.replace(/î/g, 'i').replace(/û/g, 'u');
}

export function isReformEquivalent(a: string, b: string): boolean {
  return reformCanon(a) === reformCanon(b);
}

export const NUMBER_WORDS: string[] = [
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'vingt',
  'vingts',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
  'cent',
  'cents',
  'mille',
  'million',
  'millions',
  'milliard',
  'milliards',
  'et',
];

const NUMBER_HYPHEN_RE = new RegExp(
  `(^|[^\\p{L}])(${NUMBER_WORDS.join('|')})-(?=(${NUMBER_WORDS.join('|')})(?![\\p{L}]))`,
  'giu',
);

/**
 * Turns hyphens between number words ("vingt-et-un" -> "vingt et un") into spaces so the
 * tokenizer splits them into separate tokens, while leaving other hyphenated compounds
 * ("porte-monnaie", "grand-père") untouched. Always the same length as the input, so offsets
 * computed on the result stay valid on the original text. Iterates because consuming a hyphen as
 * part of one match removes the boundary the next match needs (e.g. "vingt-et-un").
 */
export function numberHyphensToSpaces(text: string): string {
  // Fix round 1, Minor: a Unicode hyphen (U+2010) between number words counts too. Same length
  // as the ASCII hyphen it replaces, so offsets computed downstream stay valid.
  let result = text.replace(/‐/g, '-');
  for (;;) {
    const next = result.replace(NUMBER_HYPHEN_RE, '$1$2 ');
    if (next === result) return result;
    result = next;
  }
}
