// Argus passes for the proofreading screen (spec §3.4): pass order, French labels and the
// mapping of grammatical categories onto the *player's* tokens through the alignment.
import { mapAnnotation, refCategories } from './grading/annotationMap';
import { homophoneSetOf } from './grading/homophones';
import { normalizeWord } from './grading/normalize';
import type { Annotation, ArgusPass, GradeResult } from './grading/types';
import { includesParticiplesInVerbPass } from './levels';

export type { ArgusPass } from './grading/types'; // single source of truth; do not redeclare here

export const ARGUS_PASSES: ArgusPass[] = ['verbes', 'groupes_nominaux', 'homophones', 'mots_pieges'];

export const ARGUS_LABELS: Record<ArgusPass, { title: string; hint: string }> = {
  verbes: { title: 'Verbes', hint: 'Pour chaque verbe, cherche son sujet\u202f: singulier ou pluriel\u202f?' },
  groupes_nominaux: { title: 'Groupes nominaux', hint: "Déterminant, nom, adjectif\u202f: ils s'accordent ensemble." },
  homophones: { title: 'Homophones', hint: 'a ou à\u202f? et ou est\u202f? Remplace par un autre mot pour vérifier.' },
  mots_pieges: { title: 'Mots-pièges', hint: "Les mots qui t'ont déjà joué des tours. Regarde chaque lettre." },
};

/** Chouette d'Athéna hints per help stage (plan decision #6). */
export const HINTS_PER_STAGE: Record<1 | 2 | 3 | 4, number> = { 1: 3, 2: 2, 3: 1, 4: 0 };

/**
 * For each typed token, the set of Argus passes that light it. A typed token aligned to a
 * reference token inherits that token's annotation categories; an unaligned (extra) typed
 * word is lit only by what can be known from the word itself (homophone table, trap words).
 * Punctuation tokens get an empty set.
 */
export function typedPassSets(
  grade: GradeResult,
  annotation: Annotation | null,
  trapWords: string[],
  level: string,
): Set<ArgusPass>[] {
  const annots = mapAnnotation(grade.refTokens, annotation);
  const traps = new Set(trapWords.map(normalizeWord));
  const participlesAreVerbs = includesParticiplesInVerbPass(level);
  const sets = grade.typedTokens.map(() => new Set<ArgusPass>());

  for (const pair of grade.pairs) {
    if (pair.typedIndex === null) continue;
    const typed = grade.typedTokens[pair.typedIndex];
    if (typed.kind !== 'word') continue;
    const set = sets[pair.typedIndex];

    if (pair.refIndex === null) {
      if (homophoneSetOf(typed.norm) !== undefined) set.add('homophones');
      if (traps.has(typed.norm)) set.add('mots_pieges');
      continue;
    }

    const ref = grade.refTokens[pair.refIndex];
    const cats = refCategories(annots[pair.refIndex]);
    if (cats.includes('verb')) set.add('verbes');
    if (cats.includes('participle') && participlesAreVerbs) set.add('verbes');
    if (cats.includes('nominal_group')) set.add('groupes_nominaux');
    if (cats.includes('homophone')) set.add('homophones');
    if (traps.has(ref.norm) || traps.has(typed.norm)) set.add('mots_pieges');
  }
  return sets;
}

/**
 * Validates a pass order coming from the server (`argus_order`): keeps the valid, distinct
 * passes in the given order and appends the missing ones in default order, so the result is
 * always a permutation of `ARGUS_PASSES`.
 */
export function orderPasses(order: ArgusPass[] | undefined): ArgusPass[] {
  const result: ArgusPass[] = [];
  for (const p of order ?? []) {
    if (ARGUS_PASSES.includes(p) && !result.includes(p)) result.push(p);
  }
  for (const p of ARGUS_PASSES) if (!result.includes(p)) result.push(p);
  return result;
}

/**
 * The passes actually offered this session (P1-5): `orderPasses`'s result, minus `mots_pieges`
 * when the profile has no trap words yet. Spotlighting an empty pass has no token to light, so
 * `TokenText` (dim = every token not in the active pass) would dim the whole text for nothing —
 * skip the pass instead. Used for the pass chips *and* the active pass, so Bouclier/Chouette
 * (which render through the same `activePass`/`dim` props) can never land on it either.
 */
export function activePasses(order: ArgusPass[] | undefined, trapWords: string[]): ArgusPass[] {
  const passes = orderPasses(order);
  return trapWords.length > 0 ? passes : passes.filter((p) => p !== 'mots_pieges');
}
