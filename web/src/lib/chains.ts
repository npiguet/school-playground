// Chain-aware agreement queries over annotation v2's dependency chains (SP2 Task 2/7; spec
// §1.3, §3.5). A "chain" links a controller (the token that dictates agreement: a subject, a
// noun, an auxiliary's subject...) to the target token(s) that must agree with it. This module
// only *reads* chains that the server already computed (server/app/nlp/chains.py) — it never
// infers grammar itself, so it can't be wrong about French: when a caller wants an explanation
// or a Fil d'Ariane target, it asks `explainChain`/`chainsOf`, which return `undefined`/`[]` for
// anything the server didn't mark high/medium confidence, and the caller falls back to a
// generic-but-correct sentence (spec §1.3 "when uncertain, skip").
import type { Annotation, Chain, ChainKind, Confidence } from './grading/types';

/** Preferred order when several chains target the same token (e.g. a word that is both a verb
 *  agreeing with its subject and, in principle, something else): subject-verb agreement is the
 *  most teachable rule, nominal group agreement the least specific. */
export const KIND_PRIORITY: ChainKind[] = [
  'subject_verb',
  'participle_etre',
  'participle_avoir',
  'attribute',
  'nominal',
];

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };

function meetsConfidence(confidence: Confidence, min: Confidence): boolean {
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[min];
}

/** Every chain where `annotIndex` is the controller, part of the controller's det/adj group, or
 *  a target — i.e. every chain this token has a stake in, regardless of confidence. */
export function chainsOf(annotation: Annotation | null, annotIndex: number): Chain[] {
  if (!annotation?.chains) return [];
  return annotation.chains.filter(
    (c) => c.controller_group.includes(annotIndex) || c.targets.includes(annotIndex),
  );
}

/** The best chain where `annotIndex` is a TARGET (the token that must agree), at or above
 *  `min` confidence (`'medium'` by default: explanations use high+medium, Fil d'Ariane passes
 *  `'high'`). `undefined` when no such chain exists — callers must fall back to a generic
 *  template rather than guess (spec §1.3). */
export function explainChain(
  annotation: Annotation | null,
  annotIndex: number,
  min: 'high' | 'medium' = 'medium',
): Chain | undefined {
  if (!annotation?.chains) return undefined;
  const candidates = annotation.chains.filter(
    (c) => c.targets.includes(annotIndex) && meetsConfidence(c.confidence, min),
  );
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => {
    const byKind = KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind);
    if (byKind !== 0) return byKind;
    const byConfidence = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (byConfidence !== 0) return byConfidence;
    return a.distance - b.distance;
  });
  return candidates[0];
}

/** The reference text spanned by `chain`'s controller group, exactly as written — a coordinated
 *  group (`via: 'conj'`, non-contiguous member tokens) is rendered as each member's text joined
 *  with " et "; any other group is a single contiguous span, read straight from `body`. */
export function groupText(annotation: Annotation, chain: Chain, body: string): string {
  const ids = chain.controller_group;
  if (ids.length === 0) return '';
  const byId = new Map(annotation.tokens.map((t) => [t.i, t]));
  if (chain.via === 'conj') {
    return ids
      .map((id) => byId.get(id)?.text)
      .filter((t): t is string => t !== undefined)
      .join(' et ');
  }
  const members = ids.map((id) => byId.get(id)).filter((t) => t !== undefined);
  if (members.length === 0) return '';
  const start = Math.min(...members.map((t) => t.start));
  const end = Math.max(...members.map((t) => t.end));
  return body.slice(start, end);
}

export function numberWord(features: Record<string, string>): 'pluriel' | 'singulier' | null {
  if (features.Number === 'Plur') return 'pluriel';
  if (features.Number === 'Sing') return 'singulier';
  return null;
}

export function genderWord(features: Record<string, string>): 'féminin' | 'masculin' | null {
  if (features.Gender === 'Fem') return 'féminin';
  if (features.Gender === 'Masc') return 'masculin';
  return null;
}

/** "féminin pluriel" | "pluriel" | "féminin" | "" — gender before number, only the features
 *  that are actually known (spec §1.3: never assert a feature the parse didn't give us). */
export function featureWords(features: Record<string, string>): string {
  const words: string[] = [];
  const gender = genderWord(features);
  const number = numberWord(features);
  if (gender !== null) words.push(gender);
  if (number !== null) words.push(number);
  return words.join(' ');
}
