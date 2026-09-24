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

/**
 * Reverse of `mapAnnotation`: annotation token id (`AnnotToken.i`, the spaCy token index) ->
 * the client (reference) token index it was matched to (P1-1 fix). Any other spaCy-space index
 * found inside the annotation itself — `AnnotToken.head`, `AnnotToken.subject`, a chain's
 * `controller`/`via_token`/`targets` — is *not* a client token index and must never be used to
 * index `refTokens`/the `mapAnnotation` array directly; elisions (`n'`, `d'`, `l'`, `qu'`...)
 * make spaCy split a token the client tokenizer keeps whole, which shifts every later spaCy
 * index relative to the client's. Look the index up through this map first.
 */
export function reverseAnnotationMap(annots: (AnnotToken | undefined)[]): Map<number, number> {
  const out = new Map<number, number>();
  annots.forEach((a, r) => {
    if (a) out.set(a.i, r);
  });
  return out;
}
