// Sentence and breath-group (chunk) segmentation for dictation playback.
// Pure functions: no DOM, no Web Speech API. Spec §3.3.
import { tokenize } from '$lib/grading/tokenize';
import type { Token } from '$lib/grading/types';

export interface Sentence {
  text: string;
  start: number;
  end: number;
  newParagraph: boolean;
}

const ABBREVIATIONS = new Set(['M', 'MM', 'Mme', 'Mlle', 'St', 'Ste']);

// A run of terminal punctuation, optionally followed by (optional space and)
// a closing quote/paren.
const TERMINAL_RE = /[.!?…]+(?:[ \t]*["»”)])?/g;

/**
 * Splits `text` into sentences. A sentence ends at a run of `.`, `!`, `?`, `…`
 * (optionally followed by a closing quote/paren) followed by whitespace or the
 * end of text - except when the word right before a single `.` is a known
 * abbreviation, or when the next non-space character is a lower-case letter
 * (a mid-sentence ellipsis). A blank line always ends a sentence and marks the
 * next one `newParagraph: true`.
 */
export function splitSentences(text: string): Sentence[] {
  // Find blank-line boundaries: a run of whitespace containing at least two newlines.
  const BLANK_LINE_RE = /\n[ \t]*\n/g;
  const paragraphBreaks: number[] = [];
  for (const m of text.matchAll(BLANK_LINE_RE)) {
    paragraphBreaks.push(m.index ?? 0);
  }

  const boundaries: number[] = []; // end offsets (exclusive) of each sentence, in original text
  TERMINAL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERMINAL_RE.exec(text))) {
    const matchEnd = m.index + m[0].length;
    const isEndOfText = matchEnd >= text.length;
    const nextChar = isEndOfText ? '' : text[matchEnd];
    const nextIsSpace = isEndOfText || /\s/.test(nextChar);
    if (!nextIsSpace) continue; // not followed by whitespace/end -> not a boundary

    // Check for mid-sentence ellipsis: next non-space char is a lower-case letter.
    const rest = text.slice(matchEnd);
    const nextNonSpaceMatch = rest.match(/\S/);
    const nextNonSpace = nextNonSpaceMatch ? nextNonSpaceMatch[0] : '';
    if (/\p{Ll}/u.test(nextNonSpace)) continue;

    // Check for abbreviation before a single '.'. Trim first: the optional
    // closing quote can be separated from the '.' by whitespace (e.g. ". »"),
    // and that whitespace must not make this look like more than a bare '.'.
    const terminalChars = m[0].replace(/["»”)]$/, '').trim();
    if (terminalChars === '.') {
      const before = text.slice(0, m.index);
      // The word immediately preceding this '.'.
      const precedingWordMatch = before.match(/(\p{L}+)$/u);
      if (precedingWordMatch && ABBREVIATIONS.has(precedingWordMatch[0])) continue;
    }

    boundaries.push(matchEnd);
  }

  // Merge terminal-punctuation boundaries with paragraph-break boundaries and text end.
  const allBoundaries = new Set<number>(boundaries);
  for (const pb of paragraphBreaks) allBoundaries.add(pb);
  allBoundaries.add(text.length);
  const sortedBoundaries = [...allBoundaries].sort((a, b) => a - b);

  const sentences: Sentence[] = [];
  let cursor = 0;
  let nextIsNewParagraph = false;
  for (const boundary of sortedBoundaries) {
    if (boundary <= cursor) continue;
    const raw = text.slice(cursor, boundary);
    const trimmed = raw.trim();
    const isParagraphBoundary = paragraphBreaks.includes(boundary);
    if (trimmed.length > 0) {
      const leadingWs = raw.length - raw.trimStart().length;
      const start = cursor + leadingWs;
      const end = start + trimmed.length;
      sentences.push({ text: trimmed, start, end, newParagraph: nextIsNewParagraph });
      nextIsNewParagraph = false;
    }
    if (isParagraphBoundary) nextIsNewParagraph = true;
    cursor = boundary;
  }

  return sentences;
}

/** Counts `word`-kind tokens in `s`. */
export function countWords(s: string): number {
  return tokenize(s).filter((t) => t.kind === 'word').length;
}

// Where a long piece is halved (pace-bug report 2026-09-27, open item 2). Tokens carry no part of speech
// on the client, so the small French word lists below stand in for one, matched on the lower-cased
// word; `blocked` and `bestCut` say how each is used.
// `tokenize` keeps an elided word with the word it leans on (« l'île », « d'Ulysse », « qu'elle »,
// « jusqu'à » are one token each), so a cut can never fall right after « l' » or « qu' ».
//
// The auxiliaries: the forms of « avoir » and « être » that take a participle (« avait donnée »,
// « n'était pas passé »). No cut after one, nor after its negation (AFTER_NEGATION).
const AUXILIARIES = new Set([
  'ai', 'as', 'a', 'avons', 'avez', 'ont', 'avais', 'avait', 'avions', 'aviez', 'avaient',
  'eus', 'eut', 'eûmes', 'eûtes', 'eurent', 'aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront',
  'aurais', 'aurait', 'aurions', 'auriez', 'auraient', 'aie', 'aies', 'ait', 'ayons', 'ayez', 'aient', 'eût',
  'suis', 'es', 'est', 'sommes', 'êtes', 'sont', 'étais', 'était', 'étions', 'étiez', 'étaient',
  'fus', 'fut', 'fûmes', 'fûtes', 'furent', 'serai', 'seras', 'sera', 'serons', 'serez', 'seront',
  'serais', 'serait', 'serions', 'seriez', 'seraient', 'sois', 'soit', 'soyons', 'soyez', 'soient', 'fût',
]);
// A determiner: never the last word of a group; after « tous », « toute », « toutes », it makes them
// a determiner too (« tous les fruits »), where alone they end their clause (« se
// ressemblaient tous | et où… »).
const DETERMINERS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'ce', 'cet', 'cette', 'ces',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'leur', 'leurs', 'notre', 'nos', 'votre', 'vos',
  'quel', 'quelle', 'quels', 'quelles', 'chaque', 'plusieurs', 'quelques', 'l', 'd',
]);
const TOUT = new Set(['toute', 'tous', 'toutes']);
// A group never ends on a word that needs the next one: a determiner, a preposition, a subject or
// object pronoun before its verb, an auxiliary, a conjunction or a relative, the first word of a
// two-word conjunction or idiom.
//
// Trade-off: « lui », « elle », « nous », « vous », « elles » are also stressed pronouns after a
// preposition (« il se tourna vers elle | et lui sourit »), where a cut after them is fine; they are
// kept here for the far more common clitic case (« que lui avait donnée », « nous venons »).
const NO_CUT_AFTER = new Set([
  ...DETERMINERS,
  ...AUXILIARIES,
  // prepositions, and the adverbs that open a compound one (« près de », « afin de »)
  'à', 'sur', 'sous', 'par', 'pour', 'avec', 'sans', 'dans', 'en', 'vers', 'entre', 'chez', 'contre',
  'après', 'avant', 'devant', 'derrière', 'depuis', 'pendant', 'parmi', 'selon', 'malgré', 'jusque',
  'près', 'loin', 'autour', 'auprès', 'afin', 'lors', 'hors', 'grâce', 'lieu',
  // pronouns before their verb
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'lui', 'y', 'ne',
  // conjunctions and relative or subordinating words
  'et', 'ou', 'mais', 'ni', 'car', 'donc', 'or', 'qui', 'que', 'quoi', 'où', 'dont', 'quand', 'lorsque',
  'puisque', 'comme', 'si', 'lequel', 'laquelle', 'lesquels', 'lesquelles',
  // the first word of a two-word conjunction (« parce que », « tandis que », « plutôt que », « dès
  // que », « ainsi que », « alors que », « sitôt que »), and of « les uns / les unes … les autres »
  'parce', 'tandis', 'plutôt', 'dès', 'ainsi', 'alors', 'sitôt', 'uns', 'unes',
  // adverbs of degree that always lean on the next word (« très extraordinaire », « trop tard »)
  'très', 'trop', 'assez', 'tellement', 'presque',
]);
// Words that lean on the next one unless a clause or a phrase starts there (LEANS_ON_NEXT is checked
// against the next word): the pre-noun adjectives (« un petit | chaperon », « de grandes | envies »),
// which may also end a clause as an attribute (« il était petit | et… »), and the adverbs of degree
// that are also plain adverbs (« les plus | lamentables », but « il ne revint plus | dans… »). The
// cut after one is allowed only before a word of CUT_BEFORE_CLAUSE or CUT_BEFORE_PHRASE other than
// one of COMPOUND_TAILS (« plus | que », « bien | que », « même | si », « tout | comme » are never cut).
const LEANS_ON_NEXT = new Set([
  'petit', 'petite', 'petits', 'petites', 'grand', 'grande', 'grands', 'grandes', 'bon', 'bonne', 'bons', 'bonnes',
  'beau', 'bel', 'belle', 'beaux', 'belles', 'vieux', 'vieil', 'vieille', 'vieilles', 'jeune', 'jeunes',
  'joli', 'jolie', 'jolis', 'jolies', 'gros', 'grosse', 'grosses', 'long', 'longue', 'longs', 'longues',
  'mauvais', 'mauvaise', 'mauvaises', 'nouveau', 'nouvel', 'nouvelle', 'nouveaux', 'nouvelles',
  'premier', 'première', 'premiers', 'premières', 'dernier', 'dernière', 'derniers', 'dernières',
  // (not « autre(s) »: « les autres » is as often a pronoun that ends its phrase, « les uns contre les
  // autres | au fond de la grotte »)
  'même', 'mêmes', 'tout',
  'plus', 'moins', 'bien', 'aussi', 'fort',
]);
// The clause words that make a two-word conjunction with a word of LEANS_ON_NEXT before them (« bien
// que », « plus que », « même si », « tout comme »): that word never ends a group before one of these,
// though they open a clause.
const COMPOUND_TAILS = new Set(['que', 'qu', 'si', 'comme']);
// « venir de » + infinitive: no cut between a form of « venir » and its « de » (« nous venons | de
// rapporter »).
const VENIR = new Set([
  'viens', 'vient', 'venons', 'venez', 'viennent', 'venais', 'venait', 'venions', 'veniez', 'venaient',
  'vins', 'vint', 'vinrent', 'viendra', 'viendrait', 'venant', 'venu', 'venue', 'venus', 'venues', 'venir',
]);
// The negation after an auxiliary: no cut between it and the participle (« n'était pas | passé »).
const AFTER_NEGATION = new Set(['pas', 'point', 'jamais', 'plus', 'guère', 'rien']);
// Titles written with a « . » (splitSentences' ABBREVIATIONS, the one list): never a cut after its « . ».
const TITLES = ABBREVIATIONS;
// A group rather starts on one of these: a clause (a relative, a subordinating word, the first word
// of a two-word one, or a conjunction) is the best cut, a prepositional phrase the next best.
const CUT_BEFORE_CLAUSE = new Set([
  'qui', 'que', 'qu', 'lorsqu', 'puisqu', 'où', 'dont', 'quand', 'lorsque', 'puisque', 'comme', 'si', 'et', 'mais', 'ou', 'ni', 'car',
  'lequel', 'laquelle', 'lesquels', 'lesquelles', 'parce', 'tandis', 'dès',
]);
// (« au » and « aux » too, which carry their article, « un lapin blanc | aux yeux roses »; not a bare
// « à », which is as often a verb's own « commencèrent à | crever ».)
const CUT_BEFORE_PHRASE = new Set([
  'au', 'aux', 'sans', 'pour', 'avec', 'dans', 'sur', 'sous', 'par', 'vers', 'entre', 'chez', 'contre', 'après', 'avant',
  'devant', 'derrière', 'depuis', 'pendant', 'parmi', 'selon', 'malgré', 'jusqu', 'près', 'loin', 'autour',
  'auprès', 'afin', 'lors', 'grâce',
]);
// A word with an elision is read at both ends: its first part opens the group after the cut
// (« qu'elle » -> « qu », a relative), its last part closes the group before it (« qu'elle » -> « elle »,
// a subject pronoun, so no cut after it; « n'avait » -> « avait »).
const parts = (text: string): string[] => text.toLowerCase().split(/['’ʼ]/);
const firstPart = (text: string): string => parts(text)[0];
const lastPart = (text: string): string => parts(text).at(-1) ?? '';

// Liaisons (liaison report 2026-09-28). A cut between two words that carry an obligatory liaison was
// heard badly: the voice reads each group on its own, so « elles | ont » loses its /z/ and the child
// hears two words that do not belong together. So no cut there, at any pace.
//
// A liaison is obligatory after a word of LIAISON_ALWAYS, and after one of LIAISON_BEFORE_NOUN unless
// a clause or a phrase starts next (« de grands | arbres » is one, « ils étaient grands | avec… » is
// none), when the next word starts with a vowel or a mute h. Both lists hold only words that end on a
// sounded liaison consonant (s, x, z, t, d, n). A liaison across a hyphen (« vont-ils », « allez-y »)
// needs no rule: `tokenize` keeps the hyphenated word whole.
//
// LIAISON_ALWAYS: the determiners and numerals before their noun, the pronouns before their verb
// (« elles ont », « on a », « les avait »), the prepositions and adverbs the liaison always follows
// (« dans un », « chez eux », « très important », « tout entier »), « quand » and « dont », and the
// auxiliaries before their participle (« sont allés », « est arrivé »).
const LIAISON_ALWAYS = new Set([
  'les', 'des', 'ces', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs', 'aux', 'un', 'aucun', 'mon', 'ton', 'son',
  'quels', 'quelles', 'certains', 'certaines', 'plusieurs', 'quelques',
  'deux', 'trois', 'six', 'dix', 'vingt', 'vingts', 'cent', 'cents',
  'nous', 'vous', 'ils', 'elles', 'on', 'en',
  'dans', 'chez', 'sans', 'sous', 'dès', 'très', 'trop', 'tout', 'quand', 'dont',
  ...[...AUXILIARIES].filter((w) => /[sxztdn]$/.test(w)),
]);
// LIAISON_BEFORE_NOUN: the pre-noun adjectives of LEANS_ON_NEXT that end on a liaison consonant
// (« petit ami », « grands arbres »; « bel », « vieil » only run on, with no liaison) and the adverbs of
// degree before their adjective (« plus ancien », « bien aimé »).
const LIAISON_BEFORE_NOUN = new Set([
  'petit', 'petits', 'petites', 'grand', 'grands', 'grandes', 'bon', 'bons', 'bonnes', 'beaux', 'belles',
  'vieux', 'vieilles', 'jeunes', 'jolis', 'jolies', 'gros', 'grosses', 'longs', 'longues', 'mauvais', 'mauvaises',
  'nouveaux', 'nouvelles', 'premiers', 'premières', 'derniers', 'dernières', 'mêmes',
  'plus', 'moins', 'bien',
]);
// A vowel or h that takes no liaison: the h aspiré (by the start of the word, so « haut » covers
// « hauteur », « hautes », and « huit » is one; « héros » but not « héroïne », whose h is mute),
// « et » (never linked to), « onze », « oui », and the words of English origin in « y ».
const H_ASPIRE = [
  'hache', 'haie', 'haill', 'hain', 'haïr', 'hall', 'halte', 'hamac', 'hameau', 'hanche', 'handicap', 'hangar', 'hant',
  'harce', 'hardi', 'hareng', 'hargn', 'haricot', 'harnais', 'harpe', 'hasard', 'hâte', 'haut', 'hauss', 'havre',
  'hennir', 'hérisson', 'hernie', 'héron', 'héros', 'hêtre', 'heurt', 'hibou', 'hideu', 'hiérarchie', 'hisse',
  'hocher', 'hockey', 'homard', 'honte', 'hoquet', 'horde', 'hors', 'hotte', 'houle', 'housse', 'houx', 'hublot',
  'huer', 'huit', 'hurl', 'hutte',
];
const NO_LIAISON_BEFORE = new Set(['et', 'onze', 'onzième', 'onzièmes', 'oui']);
const NO_LIAISON_START = [...H_ASPIRE, 'yacht', 'yaourt', 'yoga'];
const VOWEL_START = /^[aàâäeéèêëiîïoôöuùûüyœæh]/;

/**
 * Whether the word `before` and the word `next` (the tokens around a cut, elided words included:
 * « qu'elles » is read as « elles », « l'ont » starts on « l' ») carry an obligatory liaison, which a cut
 * between them would break.
 */
export function liaisonAcross(before: string, next: string): boolean {
  const last = lastPart(before);
  const word = next.toLowerCase();
  if (!VOWEL_START.test(word)) return false; // an elided « l' », « d' », « qu' » starts on its consonant
  const head = firstPart(word);
  if (NO_LIAISON_START.some((h) => word.startsWith(h)) || NO_LIAISON_BEFORE.has(head)) return false;
  if (LIAISON_ALWAYS.has(last)) return true;
  return LIAISON_BEFORE_NOUN.has(last) && !CUT_BEFORE_CLAUSE.has(head) && !CUT_BEFORE_PHRASE.has(head);
}

/** Each group of a halved piece keeps at least this many words; a group under MIN_GOOD is penalised. */
const MIN_SIDE = 3;
const MIN_GOOD = 4;

const CAPITALISED = /^\p{Lu}/u;

/**
 * Whether a cut right before token `at` (a word) is never taken: after an opening « ( — or ", after
 * the « . » of a title (« M. | Seguin »), between two capitalised words (« Maréchal | Niel »), after
 * a word of NO_CUT_AFTER, after « toute(s) » or « tous » before a determiner, after a word of
 * LEANS_ON_NEXT unless a clause or a phrase starts next, between a form of « venir » and its « de »,
 * between an auxiliary's negation and the participle, or inside an obligatory liaison (liaisonAcross).
 */
function blocked(toks: Token[], at: number): boolean {
  const before = toks[at - 1];
  const nextText = toks[at].text;
  const next = firstPart(nextText);
  if (before.kind === 'punct') {
    if (/^[«(—–"]$/.test(before.text)) return true;
    const title = toks[at - 2];
    return before.text === '.' && title?.kind === 'word' && TITLES.has(title.text);
  }
  if (CAPITALISED.test(before.text) && CAPITALISED.test(nextText)) return true;
  if (liaisonAcross(before.text, nextText)) return true;
  const last = lastPart(before.text);
  if (NO_CUT_AFTER.has(last)) return true;
  if (TOUT.has(last) && DETERMINERS.has(next)) return true;
  if (LEANS_ON_NEXT.has(last) && (COMPOUND_TAILS.has(next) || !(CUT_BEFORE_CLAUSE.has(next) || CUT_BEFORE_PHRASE.has(next)))) {
    return true;
  }
  if (VENIR.has(last) && (next === 'de' || next === 'd')) return true;
  const beforeThat = toks[at - 2];
  if (AFTER_NEGATION.has(last) && beforeThat?.kind === 'word' && AUXILIARIES.has(lastPart(beforeThat.text))) return true;
  return false;
}

/**
 * The index, in `words` (token indices of a long piece's words), of the word a halved piece's second
 * group starts on: the cut with the lowest cost, where the cost is the distance from the middle (in
 * words), plus 2 for a cut before an ordinary word, 0.5 before a preposition, 0 before a relative or
 * conjunction, plus 1 before a capitalised word (a name in apposition, « la magicienne | Circé »),
 * plus 2 when a group would have fewer than MIN_GOOD words. A cut `blocked` is never taken. Ties go to
 * the cut closer to the middle, then to the earlier one.
 *
 * If every cut is blocked, the least bad is taken: the cut nearest the middle that splits no liaison,
 * first among those leaving MIN_SIDE words a side, then among any; only when every cut splits a liaison
 * is the middle taken. Even then the liaison is dropped, not moved (liaison report 2026-09-28): the
 * first group ends on a bare comma (spokenForm), so the voice ends it without the liaison consonant,
 * and the second group, sent alone, starts on its own vowel.
 */
function bestCut(toks: Token[], words: number[]): number {
  const n = words.length;
  const middle = n / 2;
  let best = leastBadCut(toks, words);
  let bestCost = Infinity;
  for (let k = MIN_SIDE; k <= n - MIN_SIDE; k++) {
    if (blocked(toks, words[k])) continue;
    const nextText = toks[words[k]].text;
    const next = firstPart(nextText);
    const distance = Math.abs(k - middle);
    const cost =
      distance +
      (CUT_BEFORE_CLAUSE.has(next) ? 0 : CUT_BEFORE_PHRASE.has(next) ? 0.5 : 2) +
      (CAPITALISED.test(nextText) ? 1 : 0) +
      (Math.min(k, n - k) < MIN_GOOD ? 2 : 0);
    if (cost < bestCost || (cost === bestCost && distance < Math.abs(best - middle))) {
      best = k;
      bestCost = cost;
    }
  }
  return best;
}

/** bestCut's fallback when every cut is blocked (see there). */
function leastBadCut(toks: Token[], words: number[]): number {
  const n = words.length;
  const middle = n / 2;
  const splitsLiaison = (k: number) => {
    const before = toks[words[k] - 1];
    return before.kind === 'word' && liaisonAcross(before.text, toks[words[k]].text);
  };
  for (const [from, to] of [[MIN_SIDE, n - MIN_SIDE], [1, n - 1]]) {
    let best = -1;
    for (let k = from; k <= to; k++) {
      if (!splitsLiaison(k) && (best < 0 || Math.abs(k - middle) < Math.abs(best - middle))) best = k;
    }
    if (best >= 0) return best;
  }
  return Math.floor(middle);
}

/**
 * Splits a sentence into breath groups (~4-10 words): after a word ending
 * with `,` `;` `:` `—` `–` or `»`, and before a word starting with `«` or
 * `—`; tiny pieces (<3 words) are merged into the previous chunk (or the next
 * one if first); long pieces (>10 words) are halved near the middle, at a
 * sensible boundary (bestCut), until every group has at most 10 words. Never
 * splits inside a word.
 */
export function splitChunks(sentence: string): string[] {
  const tokens = tokenize(sentence);
  if (tokens.length === 0) return [];

  // Step 1: find split points (indices into tokens, meaning "split before token i").
  const splitBefore = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'punct' && /^[,;:—–]$/.test(t.text) && i > 0) {
      // split after this punctuation token -> split before the next token
      if (i + 1 < tokens.length) splitBefore.add(i + 1);
    } else if (t.kind === 'punct' && t.text === '»' && i > 0) {
      if (i + 1 < tokens.length) splitBefore.add(i + 1);
    } else if (t.kind === 'punct' && (t.text === '«' || t.text === '—') && i > 0) {
      splitBefore.add(i);
    }
  }

  const splitIndices = [0, ...[...splitBefore].sort((a, b) => a - b), tokens.length];
  const uniqueSplits = [...new Set(splitIndices)].sort((a, b) => a - b);

  type Piece = { startTok: number; endTok: number }; // [startTok, endTok)
  let pieces: Piece[] = [];
  for (let i = 0; i < uniqueSplits.length - 1; i++) {
    const startTok = uniqueSplits[i];
    const endTok = uniqueSplits[i + 1];
    if (endTok > startTok) pieces.push({ startTok, endTok });
  }

  const pieceWordCount = (p: Piece) => {
    let n = 0;
    for (let i = p.startTok; i < p.endTok; i++) if (tokens[i].kind === 'word') n++;
    return n;
  };

  // Step 2: merge pieces with fewer than 3 words into the previous chunk
  // (into the next one if it is the first piece).
  const merged: Piece[] = [];
  for (const p of pieces) {
    if (pieceWordCount(p) < 3 && merged.length > 0) {
      merged[merged.length - 1] = { startTok: merged[merged.length - 1].startTok, endTok: p.endTok };
    } else {
      merged.push({ ...p });
    }
  }
  if (merged.length > 1 && pieceWordCount(merged[0]) < 3) {
    const first = merged.shift()!;
    merged[0] = { startTok: first.startTok, endTok: merged[0].endTok };
  }
  pieces = merged;

  const pieceText = (p: Piece) => sentence.slice(tokens[p.startTok].start, tokens[p.endTok - 1].end);

  // Step 3: split any chunk with more than 10 words at the whitespace closest
  // to its middle, repeating until all chunks have <= 10 words.
  const result: string[] = [];
  for (const p of pieces) {
    result.push(...splitLongPiece(tokens, p.startTok, p.endTok, sentence));
  }
  return result;

  function splitLongPiece(toks: typeof tokens, startTok: number, endTok: number, src: string): string[] {
    const wordTokenIndices: number[] = [];
    for (let i = startTok; i < endTok; i++) if (toks[i].kind === 'word') wordTokenIndices.push(i);
    const n = wordTokenIndices.length;
    if (n <= 10) return [src.slice(toks[startTok].start, toks[endTok - 1].end)];

    const splitTok = wordTokenIndices[bestCut(toks, wordTokenIndices)];
    return [
      ...splitLongPiece(toks, startTok, splitTok, src),
      ...splitLongPiece(toks, splitTok, endTok, src),
    ];
  }
}
