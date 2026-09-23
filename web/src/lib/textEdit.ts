// Text-editing helpers for the proofreading screen: span replacement that keeps the
// surrounding whitespace tidy, and sentence spans for the Bouclier de Persée.
import { splitSentences } from './dictation/segment';

/**
 * Replaces `[start, end)` of `text` with `replacement`. When the replacement is blank the span
 * is deleted together with one adjacent space (the following one if present, else the
 * preceding one) so that no double space or dangling space is left behind.
 */
export function replaceSpan(text: string, start: number, end: number, replacement: string): string {
  if (replacement.trim() !== '') return text.slice(0, start) + replacement + text.slice(end);
  let from = start;
  let to = end;
  const spaceBefore = from > 0 && text[from - 1] === ' ';
  const spaceAfter = text[to] === ' ';
  // Only a span that stands on its own (start of text or a space before it) takes its
  // following space with it; a span glued to the previous word (e.g. a comma) keeps it.
  if (spaceAfter && (from === 0 || spaceBefore)) to++;
  else if (spaceBefore) from--;
  return text.slice(0, from) + text.slice(to);
}

/** Character spans of the sentences of `text`, in reading order. */
export function sentenceSpans(text: string): { start: number; end: number }[] {
  return splitSentences(text).map((s) => ({ start: s.start, end: s.end }));
}
