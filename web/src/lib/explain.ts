// Kind, specific explanation templates for the results screen (spec §1.6 "specific, kind
// explanations"; spec §3.5). Every template names the concrete words involved and never blames
// the player; when the annotation can't name a subject/head/number/gender with confidence, the
// template falls back to a generic-but-correct sentence for its category rather than risk being
// wrong (spec §1.3 "when NLP is uncertain, the game skips the feature ... rather than risk
// teaching something wrong").
import {
  numberWord as chainNumberWord,
  genderWord as chainGenderWord,
  featureWords,
  explainChain,
  groupText,
} from './chains';
import { statKey as statKeyOf } from './grading/grade';
import { homophoneHint } from './grading/homophones';
import { reverseAnnotationMap } from './grading/annotationMap';
import type { Annotation, AnnotToken, StatKey, Token, TokenError } from './grading/types';
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
  /** The reference text; needed to read a controller group's exact wording (`groupText`).
   *  Falls back to `refTokens` joined with spaces when omitted (SP1 callers). */
  body?: string;
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

/**
 * The chain-aware agreement explanation (SP2 Task 7; spec §3.5 "using the subject from the
 * annotation when available"). Tries every chain kind the server may have produced for this
 * reference token, high or medium confidence (`explainChain`'s default); returns `null` when
 * there's no chain, the confidence is too low, or the kind is gated out for this level — the
 * caller then falls back to the SP1 templates below, which never name a subject/head that
 * wasn't confidently identified (spec §1.3 "when uncertain, skip").
 */
function chainAgreementText(e: TokenError, ctx: ExplainContext, expected: string): string | null {
  const refIndex = e.refIndex;
  if (refIndex === null || !ctx.annotation) return null;
  const annot = ctx.annots[refIndex];
  if (!annot) return null;
  const chain = explainChain(ctx.annotation, annot.i);
  if (!chain) return null;
  const body = ctx.body ?? ctx.refTokens.map((t) => t.text).join(' ');
  const NP = groupText(ctx.annotation, chain, body);

  if (chain.kind === 'subject_verb') {
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

  if (chain.kind === 'attribute') {
    return `« ${expected} » est attribut du sujet « ${NP} » → ${featureWords(chain.features)}`;
  }

  if (chain.kind === 'participle_etre') {
    return `Avec « être », le participe « ${expected} » s'accorde avec le sujet « ${NP} » → ${featureWords(chain.features)}`;
  }

  if (chain.kind === 'participle_avoir') {
    // Not taught before 9H (spec §3.4): without a level, or below it, fall back to the SP1
    // generic participle sentence rather than teach the avoir/COD rule early.
    if (ctx.level === undefined || levelIndex(ctx.level) < levelIndex('9H')) return null;
    if (chain.rule === 'no_agreement') {
      return `Avec « avoir », le participe « ${expected} » ne s'accorde pas avec le sujet : aucun complément n'est placé avant → « ${expected} »`;
    }
    if (chain.rule === 'cod_before') {
      return `Avec « avoir », le participe « ${expected} » s'accorde avec le complément « ${NP} » placé avant → ${featureWords(chain.features)}`;
    }
    return null;
  }

  if (chain.kind === 'nominal') {
    const controller = ctx.annotation.tokens.find((t) => t.i === chain.controller);
    if (!controller) return null;
    return `« ${expected} » s'accorde avec le nom « ${controller.text} » → ${featureWords(chain.features)}`;
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
    return `Le verbe « ${expected} » s'accorde avec son sujet. Cherche qui fait l'action.`;
  }

  if (e.sub === 'participle') {
    return (
      `Participe passé « ${expected} » : avec être, il s'accorde avec le sujet ; ` +
      `avec avoir, seulement si le complément est placé avant.`
    );
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

/** Éris's line for the results screen (spec §1.6): always taunts about her own tricks, never
 *  about the player. `draftErrors` / `introduced` are counts (result.draftErrors.length /
 *  result.introduced.length). */
export function erisLine(catchRate: number | null, draftErrors: number, introduced: number): string {
  let line: string;
  if (draftErrors === 0) {
    line = "Pfff. Tu n'as rien laissé passer pendant la dictée. Je reviendrai.";
  } else if (catchRate !== null && catchRate >= 0.8) {
    line = 'Impossible ! Tu as déjoué presque tous mes pièges. Ça ne se reproduira pas.';
  } else if (catchRate !== null && catchRate >= 0.5) {
    line = "Hmpf. La moitié de mes pièges, déjoués. J'en cacherai mieux la prochaine fois.";
  } else if (catchRate !== null && catchRate > 0) {
    line = 'Ha ! Mes pièges tiennent encore. Mais tu commences à voir clair…';
  } else {
    line = 'Mes pièges sont restés bien cachés. Cette fois.';
  }
  if (introduced > 0) {
    line += ` (Et j'en ai glissé ${introduced} pendant ta relecture. Sournois, je sais.)`;
  }
  return line;
}
