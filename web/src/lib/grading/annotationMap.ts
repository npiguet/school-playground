import type { Annotation, AnnotToken, Token } from './types';

/**
 * Maps each client (reference) token to the spaCy annotation token whose span overlaps it the
 * most (in characters). Ties go to the first spaCy token encountered. Returns `undefined` for a
 * client token with no annotation, or no overlapping annotation token.
 */
export function mapAnnotation(refTokens: Token[], annotation: Annotation | null): (AnnotToken | undefined)[] {
  if (!annotation) return refTokens.map(() => undefined);
  return refTokens.map((ref) => {
    let best: AnnotToken | undefined;
    let bestOverlap = 0;
    for (const at of annotation.tokens) {
      const overlap = Math.min(ref.end, at.end) - Math.max(ref.start, at.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = at;
      }
    }
    return best;
  });
}

export function refCategories(annot: AnnotToken | undefined): string[] {
  return annot?.categories ?? [];
}
