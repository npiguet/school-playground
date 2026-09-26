// Kind, specific explanation templates for the results screen (spec §1.6 "specific, kind
// explanations"; spec §3.5). Every template names the concrete words involved and never blames
// the player; when the annotation can't name a subject/head/number/gender with confidence, the
// template falls back to a generic-but-correct sentence for its category rather than risk being
// wrong (spec §1.3 "when NLP is uncertain, the game skips the feature ... rather than risk
// teaching something wrong").
import { numberWord as chainNumberWord, featureWords, explainChain, groupText } from './chains';
import { statKey as statKeyOf } from './grading/grade';
import { homophoneHint } from './grading/homophones';
import { mapAnnotation, reverseAnnotationMap } from './grading/annotationMap';
import { tokenize } from './grading/tokenize';
import type { Annotation, AnnotToken, Chain, StatKey, Token, TokenError } from './grading/types';
import { levelIndex } from './levels';

export type { StatKey } from './grading/types'; // single source of truth; do not redeclare here
export { statKey as statKeyOf } from './grading/grade'; // re-export, one implementation

export const CATEGORY_LABELS: Record<StatKey, string> = {
  'agreement:verb': "Accord du verbe avec son sujet (L'Hydre)",
  'agreement:number': "Accord en nombre (L'Hydre)",
  'agreement:gender': 'Accord en genre (La Chimère)',
  'agreement:participle': 'Participes passés (Protée)',
  'agreement:other': 'Accords',
  homophone: 'Homophones (Écho)',
  accent: 'Accents',
  punctuation_case: 'Majuscules et ponctuation',
  lexical: 'Orthographe des mots',
};

export interface ExplainContext {
  refTokens: Token[];
  annots: (AnnotToken | undefined)[];
  annotation: Annotation | null;
  /** The player's HarmoS level (e.g. `'9H'`); gates the participle_avoir chain explanation,
   *  which isn't taught before 9H (spec §3.4 Argus "Verbes" pass). */
  level?: string;
  /** The reference text; needed to read a controller group's exact wording (`groupText`). When
   *  omitted (SP1 callers, which never have `chains` anyway), chain-based explanations are
   *  skipped rather than reconstructed from `refTokens` (fix round 1: a naive `join(' ')`
   *  reconstruction loses the original punctuation/spacing and could misquote the group). */
  body?: string;
}

/** The context every explanation of one text reads (« Revoir », the dragon at the victory). */
export function explainContext(body: string, annotation: Annotation | null, level: string): ExplainContext {
  const refTokens = tokenize(body);
  return { refTokens, annots: mapAnnotation(refTokens, annotation), annotation, level, body };
}

/** The part of `expected` after its longest common prefix with `typed` (the changed suffix,
 *  e.g. "dansent"/"danse" -> "nt"); falls back to the last two letters when the two words share
 *  no distinguishing suffix (defensive - should not happen for a real agreement error). */
function verbEnding(expected: string, typed: string): string {
  let i = 0;
  while (i < expected.length && i < typed.length && expected[i] === typed[i]) i++;
  const ending = expected.slice(i);
  return ending.length > 0 ? ending : expected.slice(-2);
}

function numberWord(n: string | undefined): string | null {
  if (n === 'Plur') return 'pluriel';
  if (n === 'Sing') return 'singulier';
  return null;
}

function genderWord(g: string | undefined): string | null {
  if (g === 'Fem') return 'féminin';
  if (g === 'Masc') return 'masculin';
  return null;
}

// P1-1: `annot.head`/`annot.subject` are spaCy (annotation-space) token indexes, not client
// (reference) token indexes — the two disagree whenever an elision ("n'", "d'", "l'", "qu'"...)
// makes spaCy split a token the client tokenizer keeps whole. `refIndexOf` resolves an
// annotation-space index to the client ref index it was matched to, via `reverseAnnotationMap`
// (built from the same `mapAnnotation` output as `ctx.annots`, so both directions agree); the
// map is cached per `ctx.annots` array since `explain()` is called once per error but they all
// share the same context.
const reverseMapCache = new WeakMap<(AnnotToken | undefined)[], Map<number, number>>();
function refIndexOf(ctx: ExplainContext, annotIndex: number | null | undefined): number | undefined {
  if (annotIndex === null || annotIndex === undefined) return undefined;
  let map = reverseMapCache.get(ctx.annots);
  if (!map) {
    map = reverseAnnotationMap(ctx.annots);
    reverseMapCache.set(ctx.annots, map);
  }
  return map.get(annotIndex);
}

/** The reference token text of `refIndex`'s head, when that head is a NOUN; else `null` (falls
 *  back to the generic "the noun it goes with" phrase). */
function headNounText(ctx: ExplainContext, refIndex: number): string | null {
  const annot = ctx.annots[refIndex];
  if (!annot) return null;
  const headRef = refIndexOf(ctx, annot.head);
  const head = headRef !== undefined ? ctx.annots[headRef] : undefined;
  if (head?.pos !== 'NOUN') return null;
  return headRef !== undefined ? (ctx.refTokens[headRef]?.text ?? null) : null;
}

function agreementWith(head: string | null): string {
  return head !== null ? `avec « ${head} »` : "avec le nom qu'il accompagne";
}

function genericAgreement(expected: string): string {
  return `« ${expected} » doit s'accorder. Regarde le mot avec lequel il va.`;
}

function genericVerb(expected: string): string {
  return `Le verbe « ${expected} » s'accorde avec son sujet. Cherche qui fait l'action.`;
}

/** The SP1 participle sentence: the avoir/COD clause isn't taught before 9H (spec §3.4). */
function genericParticiple(expected: string, level: string | undefined): string {
  const withEtre = `Participe passé « ${expected} » : avec être, il s'accorde avec le sujet`;
  if (level !== undefined && levelIndex(level) < levelIndex('9H')) return `${withEtre}.`;
  return `${withEtre} ; avec avoir, seulement si le complément est placé avant.`;
}

// P1-3: a word with its own auxiliary (aux / aux:tense / aux:pass child) is a compound-tense or
// passive participle whatever the tagger called it — « Athéna l'avait choisie » is ADJ-tagged in
// the small model, so the grader may have filed it under gender/number; it must still get the
// participle explanation, never « s'accorde avec le nom qu'il accompagne ».
const COMPOUND_AUX_DEPS = new Set(['aux', 'aux:tense', 'aux:pass']);
function hasOwnAuxiliary(ctx: ExplainContext, annot: AnnotToken): boolean {
  return ctx.annotation?.tokens.some((t) => t.head === annot.i && t.i !== annot.i && COMPOUND_AUX_DEPS.has(t.dep)) ?? false;
}

/** "« qui », qui reprend « NP »" when the chain runs through a relative pronoun, else plain
 *  "« NP »" — factors out the phrasing fix round 1 asked for on `attribute`/`participle_etre`
 *  (subject_verb already had its own distinct qui-phrasing and is left as-is). */
function subjectPhrase(chain: Chain, NP: string): string {
  return chain.via === 'qui' ? `« qui », qui reprend « ${NP} »` : `« ${NP} »`;
}

/**
 * The chain-aware agreement explanation (SP2 Task 7; spec §3.5 "using the subject from the
 * annotation when available"). Tries every chain kind the server may have produced for this
 * reference token, high or medium confidence (`explainChain`'s default); returns `null` when
 * there's no chain, the confidence is too low, the kind is gated out for this level, the caller
 * didn't supply `body` (needed to read the controller group's exact wording), or the chain's own
 * features are empty (nothing to safely say beyond "it must agree") — the caller then falls back
 * to the SP1 templates below, which never name a subject/head/feature that wasn't confidently
 * identified (spec §1.3 "when uncertain, skip").
 */
function chainAgreementText(e: TokenError, ctx: ExplainContext, expected: string): string | null {
  const refIndex = e.refIndex;
  if (refIndex === null || !ctx.annotation || ctx.body === undefined) return null;
  const annot = ctx.annots[refIndex];
  if (!annot) return null;
  const chain = explainChain(ctx.annotation, annot.i);
  if (!chain) return null;
  const NP = groupText(ctx.annotation, chain, ctx.body);

  if (chain.kind === 'subject_verb') {
    // P1-2: a subject group that can't be quoted as written (see `groupText`) is never named.
    // The generic sentence is returned here rather than `null` so the caller's SP1 fallback
    // doesn't name `annot.subject` instead — for a mis-parsed coordination that is the very
    // false subject (« soir ») the chain was refused for.
    if (NP === '') return genericVerb(expected);
    const num = chainNumberWord(chain.features) ?? 'singulier';
    const ending = verbEnding(expected, e.typed ?? '');
    if (chain.via === 'qui') {
      return `« ${expected} » s'accorde avec « qui », qui reprend « ${NP} » → ${num} → terminaison « ${ending} »`;
    }
    if (chain.via === 'conj') {
      return `« ${expected} » a plusieurs sujets : « ${NP} » → pluriel → terminaison « ${ending} »`;
    }
    return `« ${expected} » s'accorde avec son sujet « ${NP} » → ${num} → terminaison « ${ending} »`;
  }

  if (NP === '') return null;

  if (chain.kind === 'attribute') {
    const fw = featureWords(chain.features);
    if (fw === '') return null;
    return `« ${expected} » est attribut du sujet ${subjectPhrase(chain, NP)} → ${fw}`;
  }

  if (chain.kind === 'participle_etre') {
    const fw = featureWords(chain.features);
    if (fw === '') return null;
    return `Avec « être », le participe « ${expected} » s'accorde avec le sujet ${subjectPhrase(chain, NP)} → ${fw}`;
  }

  if (chain.kind === 'participle_avoir') {
    // Not taught before 9H (spec §3.4): without a level, or below it, fall back to the SP1
    // generic participle sentence rather than teach the avoir/COD rule early.
    if (ctx.level === undefined || levelIndex(ctx.level) < levelIndex('9H')) return null;
    if (chain.rule === 'no_agreement') {
      return `Avec « avoir », le participe « ${expected} » ne s'accorde pas avec le sujet : aucun complément n'est placé avant → « ${expected} »`;
    }
    if (chain.rule === 'cod_before') {
      // A clitic COD (« l' », « les ») carries no gender in the parse: when the chain knows none
      // of the features she slipped on (« choisie » → « choisi » with only Number known), point
      // at the pronoun's referent instead of asserting a number she didn't get wrong.
      const typed = e.typed ?? '';
      const strip = (w: string) => w.replace(/[sx]$/u, '');
      const genderSlip = strip(expected) !== strip(typed);
      const numberSlip = /[sx]$/u.test(expected) !== /[sx]$/u.test(typed);
      const fw = featureWords(chain.features);
      const covered =
        (genderSlip && chain.features.Gender !== undefined) || (numberSlip && chain.features.Number !== undefined);
      if (fw === '' || !covered) {
        return `Avec « avoir », le participe « ${expected} » s'accorde avec le complément « ${NP} » placé avant. Regarde ce que « ${NP} » remplace.`;
      }
      return `Avec « avoir », le participe « ${expected} » s'accorde avec le complément « ${NP} » placé avant → ${fw}`;
    }
    return null;
  }

  if (chain.kind === 'nominal') {
    const controller = ctx.annotation.tokens.find((t) => t.i === chain.controller);
    if (!controller) return null;
    const fw = featureWords(chain.features);
    if (fw === '') return null;
    return `« ${expected} » s'accorde avec le nom « ${controller.text} » → ${fw}`;
  }

  return null;
}

function explainAgreement(e: TokenError, ctx: ExplainContext, expected: string): string {
  const chainText = chainAgreementText(e, ctx, expected);
  if (chainText !== null) return chainText;

  const refIndex = e.refIndex;
  const annot = refIndex !== null ? ctx.annots[refIndex] : undefined;

  if (e.sub === 'verb') {
    const subjectRef = refIndexOf(ctx, annot?.subject);
    if (subjectRef !== undefined) {
      const subject = ctx.refTokens[subjectRef]?.text;
      const number = numberWord(ctx.annots[subjectRef]?.morph.Number);
      if (subject && number) {
        const ending = verbEnding(expected, e.typed ?? '');
        return `« ${expected} » s'accorde avec son sujet « ${subject} » → ${number} → terminaison « ${ending} »`;
      }
    }
    return genericVerb(expected);
  }

  // P1-3: a compound-tense participle filed under gender/number (ADJ-tagged in an older
  // annotation) still gets the participle rule, never the noun-group sentence.
  if (e.sub === 'participle' || (annot !== undefined && hasOwnAuxiliary(ctx, annot))) {
    return genericParticiple(expected, ctx.level);
  }

  if (e.sub === 'number' || e.sub === 'gender') {
    const value = e.sub === 'number' ? numberWord(annot?.morph.Number) : genderWord(annot?.morph.Gender);
    if (value && refIndex !== null) {
      const head = headNounText(ctx, refIndex);
      return `« ${expected} » s'accorde ${agreementWith(head)} → ${value}`;
    }
  }

  return genericAgreement(expected);
}

export function explain(e: TokenError, ctx: ExplainContext): { title: string; text: string } {
  const title = CATEGORY_LABELS[statKeyOf(e)];
  const expected = e.expected ?? '';
  const typed = e.typed ?? '';

  let text: string;
  if (e.category === 'homophone') {
    if (e.sub === 'verb_ending') {
      text =
        `« ${typed} » ou « ${expected} » ? Après un mot comme « avoir » ou « être », c'est un participe (-é) ; ` +
        `quand on peut remplacer par « vendre », c'est l'infinitif (-er). Ici : « ${expected} ».`;
    } else {
      text = `« ${typed} » ou « ${expected} » ? Ici il faut « ${expected} ». ${homophoneHint(e.homophoneSet ?? '')}`;
    }
  } else if (e.category === 'agreement') {
    text = explainAgreement(e, ctx, expected);
  } else if (e.category === 'accent') {
    text = `Un accent change tout : « ${expected} », pas « ${typed} ».`;
  } else if (e.category === 'punctuation_case') {
    if (e.typed === null) text = `Il manque « ${expected} » ici.`;
    else if (e.expected === null) text = `« ${typed} » est en trop.`;
    else text = `Majuscule ou minuscule : « ${expected} ».`;
  } else {
    // lexical
    if (e.sub === 'missing') text = `Un mot a disparu : « ${expected} ».`;
    else if (e.sub === 'extra') text = `Un mot en trop : « ${typed} ».`;
    else if (e.sub === 'sound_alike')
      text = `« ${typed} » se prononce comme « ${expected} », mais ici c'est « ${expected} ». Il rejoint tes mots-pièges.`;
    else text = `Ce mot s'écrit « ${expected} ». Il rejoint tes mots-pièges pour t'entraîner.`;
  }

  return { title, text };
}

/** The results screen's "you fixed this yourself" popover for a caught error (spec §1.4 "fixing
 *  her own error is worth much more"). `caught.typed` is the word she originally wrote in the
 *  draft - except for a word she'd *omitted* in the draft and only added while proofreading,
 *  where it's `null`; that case needs its own sentence, not just a "null" fallback. Phrased so
 *  no past participle ever needs to agree with a preceding direct-object pronoun of unknown
 *  gender/number: "as corrigé" has no preceding clitic object, and "de l'ajouter" is an
 *  infinitive (infinitives never agree, unlike a past participle after "l'as ajouté(e)(s)"). */
export function caughtText(caught: TokenError): string {
  const expected = caught.expected ?? '';
  if (caught.typed !== null) {
    return `Tu avais écrit « ${caught.typed} », tu as corrigé en « ${expected} ». Bravo !`;
  }
  return `Tu avais oublié « ${expected} » : tu as bien fait de l'ajouter en te relisant. Bravo !`;
}
