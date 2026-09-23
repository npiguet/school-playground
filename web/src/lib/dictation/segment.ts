// Sentence and breath-group (chunk) segmentation for dictation playback.
// Pure functions: no DOM, no Web Speech API. Spec §3.3.
import { tokenize } from '$lib/grading/tokenize';

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

const SPLIT_AFTER_RE = /^[,;:—–»]$|,$|;$|:$|—$|–$|»$/;

/**
 * Splits a sentence into breath groups (~4-10 words): after a word ending
 * with `,` `;` `:` `—` `–` or `»`, and before a word starting with `«` or
 * `—`; tiny pieces (<3 words) are merged into the previous chunk (or the next
 * one if first); long pieces (>10 words) are split near the middle. Never
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

    // Split at the word boundary closest to the middle of the piece (by word
    // count): the first half gets floor(n/2) words, the rest go to the
    // second half.
    const half = Math.floor(n / 2);
    const splitTok = wordTokenIndices[half];
    return [
      ...splitLongPiece(toks, startTok, splitTok, src),
      ...splitLongPiece(toks, splitTok, endTok, src),
    ];
  }
}
