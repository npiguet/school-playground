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
// word (dû/du, mûr/mur, sûr/sur, jeûne/jeune, croît/croît family). "fût" is added here rather
// than left to the ENDING regex below: it shares its bare "-ût" ending with ordinary nouns that
// DO lose the circumflex under the reform (coût -> cout, affût -> affut), so the ambiguity can
// only be resolved per-word, not by a suffix pattern.
const CIRCUMFLEX_PROTECTED = new Set([...data.circumflex_protected, 'fût']);

// Verb-tense endings that keep the circumflex under the reform regardless of which verb: 1st/2nd
// person plural of the simple past ("-îmes"/"-ûmes", "-îtes"/"-ûtes"), 3rd singular imperfect
// subjunctive ("-ît"/"-ût"), and the venir/tenir-family irregular 3rd singular ("-înt"). Unlike
// the bare "-t" ending (see CIRCUMFLEX_PROTECTED above), these multi-letter suffixes are
// effectively verb-only in French, so a plain regex is safe here.
const VERB_ENDING = /[îû](mes|tes|nt)$/;

export function reformCanon(norm: string): string {
  const explicit = toTraditional.get(norm);
  if (explicit !== undefined) return explicit;
  for (const { re, replacement } of elerRegexes) {
    if (re.test(norm)) return norm.replace(re, replacement);
  }
  if (!CIRCUMFLEX_PROTECTED.has(norm) && !VERB_ENDING.test(norm)) {
    return norm.replace(/î/g, 'i').replace(/û/g, 'u');
  }
  return norm;
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
  let result = text;
  for (;;) {
    const next = result.replace(NUMBER_HYPHEN_RE, '$1$2 ');
    if (next === result) return result;
    result = next;
  }
}
