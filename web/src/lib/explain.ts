// Kind, specific explanation templates for the results screen (spec §1.6 "specific, kind
// explanations"; spec §3.5). Every template names the concrete words involved and never blames
// the player; when the annotation can't name a subject/head/number/gender with confidence, the
// template falls back to a generic-but-correct sentence for its category rather than risk being
// wrong (spec §1.3 "when NLP is uncertain, the game skips the feature ... rather than risk
// teaching something wrong").
import { statKey as statKeyOf } from './grading/grade';
import { homophoneHint } from './grading/homophones';
import type { Annotation, AnnotToken, StatKey, Token, TokenError } from './grading/types';

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

/** The reference token text of `refIndex`'s head, when that head is a NOUN; else `null` (falls
 *  back to the generic "the noun it goes with" phrase). */
function headNounText(ctx: ExplainContext, refIndex: number): string | null {
  const annot = ctx.annots[refIndex];
  if (!annot) return null;
  const head = ctx.annots[annot.head];
  if (head?.pos !== 'NOUN') return null;
  return ctx.refTokens[annot.head]?.text ?? null;
}

function agreementWith(head: string | null): string {
  return head !== null ? `avec « ${head} »` : "avec le nom qu'il accompagne";
}

function genericAgreement(expected: string): string {
  return `« ${expected} » doit s'accorder. Regarde le mot avec lequel il va.`;
}

function explainAgreement(e: TokenError, ctx: ExplainContext, expected: string): string {
  const refIndex = e.refIndex;
  const annot = refIndex !== null ? ctx.annots[refIndex] : undefined;

  if (e.sub === 'verb') {
    const subjectIndex = annot?.subject;
    if (subjectIndex !== null && subjectIndex !== undefined) {
      const subject = ctx.refTokens[subjectIndex]?.text;
      const number = numberWord(ctx.annots[subjectIndex]?.morph.Number);
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
