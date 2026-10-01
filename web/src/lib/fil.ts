// Fil d'Ariane (spec §3.4): "tap a verb, then its subject; checked against the dependency parse."
// A pure state machine — ProofPhase.svelte owns the `$state<FilState>` and calls `filTap` on every
// token tap while the tool is active; nothing here touches the DOM or the player's text. A tap is
// judged against the same high- or medium-confidence chains the explanations trust (`explainChain`'s
// default, spec §1.3): high alone left most verbs of a real text refused (a subject through « qui »,
// far away, or shared by coordinated verbs is medium). A verb whose only chain is low confidence is
// refused with "s'emmêle" rather than guessed at; an imperative, which has no written subject, says so.
//
// Fix round 1 (Fable review, critical): messages must quote the PLAYER's typed words, never the
// reference spelling — this tool runs live during proofreading, before mistakes are revealed, so
// reading `annotation.tokens[...].text` (or slicing the reference body) would hand out the
// answer, whatever the aids. Every caller passes a `typedTextOf` lookup (annotation token id ->
// the text of the typed token it's currently aligned to, or `undefined` when unaligned); the
// annotation itself is only ever read for structure (POS/categories, chains, features), never
// for a word to display.
import { explainChain, isContiguousGroup, numberWord } from './chains';
import type { Annotation, Chain } from './grading/types';

export type FilStep = 'idle' | 'pick-verb' | 'pick-subject' | 'done';

/** Resolves an annotation token id to the text of the typed token currently aligned to it, or
 *  `undefined` when there is no typed counterpart (unaligned/deleted word). Built by the caller
 *  (ProofPhase.svelte) from the live alignment — never from the reference text. */
export type TypedTextLookup = (annotIndex: number) => string | undefined;

export interface FilState {
  step: FilStep;
  verbRef: number | null; // annotation token index of the picked verb
  chainId: number | null;
  attempts: number;
  message: string;
  drawn: number; // threads attempted this session (persisted across Fil sessions via PlayState.fil)
  correct: number; // threads solved correctly on the first or second try
  highlightVerb: number | null; // annotation token index
  highlightSubject: number[]; // annotation token indexes
}

export const FIL_START = "Touche un verbe, puis son sujet.";

const MAX_ATTEMPTS = 2;

export function filStart(prev?: { drawn: number; correct: number }): FilState {
  return {
    step: 'pick-verb',
    verbRef: null,
    chainId: null,
    attempts: 0,
    message: FIL_START,
    drawn: prev?.drawn ?? 0,
    correct: prev?.correct ?? 0,
    highlightVerb: null,
    highlightSubject: [],
  };
}

export function filExit(state: FilState): FilState {
  return {
    step: 'idle',
    verbRef: null,
    chainId: null,
    attempts: 0,
    message: '',
    drawn: state.drawn,
    correct: state.correct,
    highlightVerb: null,
    highlightSubject: [],
  };
}

/** The controller group's typed wording, in the group's given order, omitting any member with
 *  no typed counterpart — never the reference spelling (see module comment). A coordinated
 *  group is a contiguous span that already holds its own « et » (annotation v3), so members are
 *  always joined with a plain space. */
function typedGroupText(chain: Chain, typedTextOf: TypedTextLookup): string {
  const texts = chain.controller_group.map(typedTextOf).filter((t): t is string => t !== undefined);
  return texts.join(' ');
}

function pickVerb(
  state: FilState,
  annotIndex: number | undefined,
  annotation: Annotation,
  typedTextOf: TypedTextLookup,
): FilState {
  if (annotIndex === undefined) {
    return { ...state, message: "Le fil d'Ariane ne s'accroche pas à ce mot. Cherche un verbe conjugué." };
  }
  const token = annotation.tokens[annotIndex];
  if (!token || !token.categories.includes('verb')) {
    return {
      ...state,
      message: 'Ce mot ne semble pas être un verbe conjugué. Cherche un mot qui dit ce que fait quelqu\'un.',
    };
  }
  const chain = explainChain(annotation, annotIndex);
  const verbText = typedTextOf(annotIndex) ?? '';
  if (!chain || chain.kind !== 'subject_verb' || !isContiguousGroup(chain.controller_group)) {
    if (!chain && token.morph.Mood === 'Imp') {
      return {
        ...state,
        message: `«\u202f${verbText}\u202f» est à l'impératif\u202f: il n'a pas de sujet écrit. Essaie un autre verbe.`,
      };
    }
    return { ...state, message: "Le fil d'Ariane s'emmêle sur ce verbe. Essaie un autre verbe." };
  }
  return {
    ...state,
    step: 'pick-subject',
    verbRef: annotIndex,
    chainId: chain.id,
    attempts: 0,
    highlightVerb: annotIndex,
    highlightSubject: [],
    message: `Verbe\u202f: «\u202f${verbText}\u202f». Maintenant, touche son sujet.`,
  };
}

function pickSubject(
  state: FilState,
  annotIndex: number | undefined,
  annotation: Annotation,
  typedTextOf: TypedTextLookup,
): FilState {
  if (annotIndex === state.verbRef) {
    return filStart({ drawn: state.drawn, correct: state.correct });
  }
  const chain = annotation.chains?.find((c) => c.id === state.chainId);
  const verb = state.verbRef !== null ? typedTextOf(state.verbRef) ?? '' : '';
  if (!chain) {
    // Defensive: the chain the verb pick relied on has vanished (shouldn't happen — the
    // annotation is immutable for the session). Bail out to a fresh pick rather than crash.
    return filStart({ drawn: state.drawn, correct: state.correct });
  }
  const group = typedGroupText(chain, typedTextOf);
  const num = numberWord(chain.features) ?? 'singulier';
  const isCorrect =
    annotIndex !== undefined && (chain.controller_group.includes(annotIndex) || annotIndex === chain.via_token);

  if (isCorrect) {
    const prefix = chain.via === 'qui' ? `«\u202fqui\u202f» reprend «\u202f${group}\u202f». ` : '';
    return {
      ...state,
      step: 'done',
      drawn: state.drawn + 1,
      correct: state.correct + 1,
      highlightSubject: chain.controller_group,
      message: `${prefix}Le fil est tendu entre «\u202f${verb}\u202f» et «\u202f${group}\u202f» (${num}). Vérifie la terminaison du verbe.`,
    };
  }

  if (state.attempts + 1 < MAX_ATTEMPTS) {
    return {
      ...state,
      attempts: state.attempts + 1,
      message: `Le fil ne tient pas. Le sujet, c'est qui fait l'action de «\u202f${verb}\u202f». Réessaie.`,
    };
  }

  return {
    ...state,
    step: 'done',
    drawn: state.drawn + 1,
    highlightSubject: chain.controller_group,
    message: `Le fil te guide\u202f: le sujet de «\u202f${verb}\u202f», c'est «\u202f${group}\u202f» (${num}).`,
  };
}

/** What a tap means once a thread is drawn (`done`) — SP2 playability P1-7: the Fil stays armed
 *  until the player turns it off, so a tap on another verb starts a new thread; a tap on the
 *  threaded verb itself, or on any non-verb, hands the word to the editor (« Vérifie la
 *  terminaison du verbe » invites exactly that) while the Fil goes back to picking. */
export function filDoneAction(
  state: FilState,
  annotIndex: number | undefined,
  annotation: Annotation,
): 'thread' | 'edit' {
  if (state.step !== 'done' || annotIndex === undefined || annotIndex === state.highlightVerb) return 'edit';
  return annotation.tokens[annotIndex]?.categories.includes('verb') ? 'thread' : 'edit';
}

export function filTap(
  state: FilState,
  annotIndex: number | undefined,
  annotation: Annotation,
  typedTextOf: TypedTextLookup,
): FilState {
  switch (state.step) {
    case 'pick-verb':
      return pickVerb(state, annotIndex, annotation, typedTextOf);
    case 'pick-subject':
      return pickSubject(state, annotIndex, annotation, typedTextOf);
    case 'done': {
      // A new thread from a fresh pick; anything else re-arms the Fil without touching the tap
      // (the caller opens the editor for it).
      const rearmed = filStart({ drawn: state.drawn, correct: state.correct });
      return filDoneAction(state, annotIndex, annotation) === 'thread'
        ? pickVerb(rearmed, annotIndex, annotation, typedTextOf)
        : rearmed;
    }
    case 'idle':
    default:
      return state;
  }
}
