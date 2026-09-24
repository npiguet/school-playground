import type { Token } from './types';
import { normalizeWord, caseNormalizeWord } from './normalize';
import { numberHyphensToSpaces, reformCanon } from './reform';

// Inner separator class also accepts U+2010 (Unicode hyphen), which some sources use in place of
// the ASCII hyphen-minus inside compounds (deferred SP1 minor, absorbed here — plan decision 13).
const TOKEN_RE = /[\p{L}\p{N}]+(?:['’ʼ‐-][\p{L}\p{N}]+)*|\.{2,}|…|[^\s\p{L}\p{N}]/gu;
const WORD_START_RE = /^[\p{L}\p{N}]/u;

export function tokenize(text: string): Token[] {
  // Number-word hyphens ("vingt-et-un") become spaces before matching, so they split into
  // separate tokens; numberHyphensToSpaces preserves length, so offsets found in `split` are
  // valid in `text` too, and the original hyphenated spelling is recovered via `raw` below.
  const split = numberHyphensToSpaces(text);
  const tokens: Token[] = [];
  for (const m of split.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const raw = text.slice(start, end);
    const kind: Token['kind'] = WORD_START_RE.test(raw) ? 'word' : 'punct';
    tokens.push({
      text: raw,
      norm: reformCanon(normalizeWord(raw)),
      caseNorm: caseNormalizeWord(raw),
      start,
      end,
      kind,
    });
  }
  return tokens;
}
