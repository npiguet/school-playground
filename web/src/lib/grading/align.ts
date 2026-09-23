import type { AlignedPair, Token } from './types';
import { homophoneSetOf } from './homophones';

const GAP_COST = 1;
const PUNCT_SUB_COST = 0.5;
const WORD_SIMILAR_COST = 0.6;
const WORD_DISSIMILAR_COST = 1.2;
const WORD_PUNCT_COST = 3;
const SIMILARITY_THRESHOLD = 0.5;

/** Classic Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
      }
    }
  }
  return d[n][m];
}

export function similar(a: Token, b: Token): boolean {
  const setA = homophoneSetOf(a.norm);
  if (setA !== undefined && setA === homophoneSetOf(b.norm)) return true;
  const maxLen = Math.max(a.norm.length, b.norm.length);
  if (maxLen === 0) return true;
  return 1 - levenshtein(a.norm, b.norm) / maxLen >= SIMILARITY_THRESHOLD;
}

function substitutionCost(ref: Token, typed: Token): number {
  if (ref.kind !== typed.kind) return WORD_PUNCT_COST;
  if (ref.norm === typed.norm) return 0;
  if (ref.kind === 'punct') return PUNCT_SUB_COST;
  return similar(ref, typed) ? WORD_SIMILAR_COST : WORD_DISSIMILAR_COST;
}

type Move = 'diag' | 'up' | 'left';

/**
 * Needleman-Wunsch alignment of the reference tokens against the typed tokens.
 * Traceback ties are broken diagonal first, then "missing" (ref unpaired), then "extra".
 */
export function alignTokens(ref: Token[], typed: Token[]): AlignedPair[] {
  const n = ref.length;
  const m = typed.length;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const move: (Move | null)[][] = Array.from({ length: n + 1 }, () => new Array<Move | null>(m + 1).fill(null));

  for (let i = 1; i <= n; i++) {
    cost[i][0] = i * GAP_COST;
    move[i][0] = 'up';
  }
  for (let j = 1; j <= m; j++) {
    cost[0][j] = j * GAP_COST;
    move[0][j] = 'left';
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diagCost = cost[i - 1][j - 1] + substitutionCost(ref[i - 1], typed[j - 1]);
      const upCost = cost[i - 1][j] + GAP_COST; // ref token i-1 unpaired
      const leftCost = cost[i][j - 1] + GAP_COST; // typed token j-1 unpaired

      let best = diagCost;
      let bestMove: Move = 'diag';
      if (upCost < best) {
        best = upCost;
        bestMove = 'up';
      }
      if (leftCost < best) {
        best = leftCost;
        bestMove = 'left';
      }
      cost[i][j] = best;
      move[i][j] = bestMove;
    }
  }

  const pairs: AlignedPair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const m0 = i > 0 && j > 0 ? move[i][j] : i > 0 ? 'up' : 'left';
    if (m0 === 'diag') {
      pairs.push({ refIndex: i - 1, typedIndex: j - 1 });
      i--;
      j--;
    } else if (m0 === 'up') {
      pairs.push({ refIndex: i - 1, typedIndex: null });
      i--;
    } else {
      pairs.push({ refIndex: null, typedIndex: j - 1 });
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}
