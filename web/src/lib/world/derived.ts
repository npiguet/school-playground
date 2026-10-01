// Client-side derived stat categories (SP3 decision 2): `derived:sirenes` and `derived:lethe`
// ride on the existing SP1 grading pipeline unchanged - the server just stores whatever keys
// show up in `result.byCategory`. Pure functions, no API calls, so this file works today even
// on the server side: the server only stores the keys and reads them per lieutenant.
import { errorKey, gradeText, mapAnnotation } from '../grading';
import type { Annotation, AnnotToken, CategoryStat, Chain, SessionResult, TokenError } from '../grading/types';

export const DERIVED_KEYS = ['derived:sirenes', 'derived:lethe'] as const;

const LETHE_MIN_WORDS = 60;

/** True when some annotation token strictly between `a` and `b` is a pronoun that isn't the
 *  subject (`nsubj`) - the "object pronoun slipped between subject and verb" Sirènes trap. */
function pronBetween(annots: (AnnotToken | undefined)[], a: number, b: number): boolean {
  for (let j = Math.min(a, b) + 1; j < Math.max(a, b); j++) {
    const t = annots[j];
    if (t && t.pos === 'PRON' && t.dep !== 'nsubj') return true;
  }
  return false;
}

/** True when a verb's agreement error is "sirène-like" (spec's lieutenant Sirènes): the subject
 *  is separated from the verb by a relative `qui`, sits far away (>= 4 tokens), comes after the
 *  verb (inversion), or is separated from it by an object pronoun. Prefers annotation v2
 *  subject-verb chains (ignoring `low`-confidence ones); falls back to the v1 `subject` field
 *  when no chains are available. `refIndex` and the chain ids/subject field live in different
 *  index spaces (client reference tokens vs. spaCy tokens) - `annots[i].i` is the bridge. */
export function sireneLike(
  annots: (AnnotToken | undefined)[],
  chains: Chain[] | undefined,
  refIndex: number,
): boolean {
  const a = annots[refIndex];
  if (!a) return false;
  if (chains && chains.length) {
    for (const ch of chains) {
      if (ch.kind !== 'subject_verb' || ch.confidence === 'low' || !ch.targets.includes(a.i)) continue;
      const c = ch.controller;
      const cRef = annots.findIndex((t) => t?.i === c);
      if (ch.via === 'qui' || ch.distance >= 4 || c > a.i || (cRef >= 0 && pronBetween(annots, cRef, refIndex))) {
        return true;
      }
    }
    return false;
  }
  if (a.subject === null || a.subject === undefined) return false;
  const sRef = annots.findIndex((t) => t?.i === a.subject);
  return Math.abs(a.subject - a.i) >= 4 || a.subject > a.i || (sRef >= 0 && pronBetween(annots, sRef, refIndex));
}

/** Léthé's cut point: the last third of the reference token stream (floor), where a tired
 *  reader's attention fades (spec's lieutenant Léthé). */
export function letheCut(n: number): number {
  return Math.floor((2 * n) / 3);
}

function stat(
  errs: TokenError[],
  caughtKeys: Set<string>,
  pick: (e: TokenError) => boolean,
  opportunities: number,
  introduced: TokenError[],
): CategoryStat {
  const draft = errs.filter(pick);
  const caught = draft.filter((e) => caughtKeys.has(errorKey(e))).length;
  return { opportunities, draft: draft.length, caught, missed: draft.length - caught, introduced: introduced.filter(pick).length };
}

/** Adds `derived:sirenes`/`derived:lethe` entries to a session's `byCategory` when the text/
 *  annotation offer any opportunities for them, leaving every existing key untouched. `reference`
 *  and `draft` are re-tokenized/re-aligned here (independent of whatever `result` already
 *  computed) purely to locate each draft error's reference-token position and the sirène-like
 *  verbs; the identity used to decide "caught" is the same `errorKey` the grading pipeline itself
 *  uses, so a derived category's catch/miss counts agree with the rest of `result`. */
export function withDerivedCategories(
  result: SessionResult,
  reference: string,
  draft: string,
  annotation: Annotation | null,
): SessionResult {
  const grade = gradeText(reference, draft, annotation);
  const annots = mapAnnotation(grade.refTokens, annotation);
  const words = grade.refTokens.filter((t) => t.kind === 'word');
  const caughtKeys = new Set(result.caught.map(errorKey));
  const byCategory = { ...result.byCategory } as Record<string, CategoryStat>;

  if (words.length >= LETHE_MIN_WORDS) {
    const cut = letheCut(grade.refTokens.length);
    const inLast = (e: TokenError) => (e.refIndex ?? e.anchor) >= cut;
    const opportunities = grade.refTokens.filter((t, i) => i >= cut && t.kind === 'word').length;
    byCategory['derived:lethe'] = stat(result.draftErrors, caughtKeys, inLast, opportunities, result.introduced);
  }

  if (annotation) {
    const isSirene = (i: number) => (annots[i]?.categories.includes('verb') ?? false) && sireneLike(annots, annotation.chains, i);
    let opportunities = 0;
    grade.refTokens.forEach((_t, i) => {
      if (isSirene(i)) opportunities++;
    });
    if (opportunities > 0) {
      const pick = (e: TokenError) => e.category === 'agreement' && e.refIndex !== null && isSirene(e.refIndex);
      byCategory['derived:sirenes'] = stat(result.draftErrors, caughtKeys, pick, opportunities, result.introduced);
    }
  }

  return { ...result, byCategory: byCategory as SessionResult['byCategory'] };
}
