import type { Token } from './types';
import { normalizeWord, caseNormalizeWord } from './normalize';

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’ʼ-][\p{L}\p{N}]+)*|\.{2,}|…|[^\s\p{L}\p{N}]/gu;
const WORD_START_RE = /^[\p{L}\p{N}]/u;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[0];
    const start = m.index ?? 0;
    const kind: Token['kind'] = WORD_START_RE.test(t) ? 'word' : 'punct';
    tokens.push({
      text: t,
      norm: normalizeWord(t),
      caseNorm: caseNormalizeWord(t),
      start,
      end: start + t.length,
      kind,
    });
  }
  return tokens;
}
