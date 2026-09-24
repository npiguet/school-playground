// Fil d'Ariane (spec §3.4): "tap a verb, then its subject; checked against the dependency parse
// only when the parse is high-confidence." A pure state machine — Proofreading.svelte owns the
// `$state<FilState>` and calls `filTap` on every token tap while the tool is active; nothing
// here touches the DOM or the player's text. Only `explainChain(..., 'high')` chains are ever
// used to judge a tap (spec §1.3): a verb whose only chain is medium/low confidence is refused
// with "s'emmêle" rather than silently guessed at.
import { explainChain, groupText, numberWord } from './chains';
import type { Annotation } from './grading/types';

export type FilStep = 'idle' | 'pick-verb' | 'pick-subject' | 'done';

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

function pickVerb(state: FilState, annotIndex: number | undefined, annotation: Annotation): FilState {
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
  const chain = explainChain(annotation, annotIndex, 'high');
  if (!chain || chain.kind !== 'subject_verb') {
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
    message: `Verbe : « ${token.text} ». Maintenant, touche son sujet.`,
  };
}

function pickSubject(
  state: FilState,
  annotIndex: number | undefined,
  annotation: Annotation,
  body: string,
): FilState {
  if (annotIndex === state.verbRef) {
    return filStart({ drawn: state.drawn, correct: state.correct });
  }
  const chain = annotation.chains?.find((c) => c.id === state.chainId);
  const verb = state.verbRef !== null ? annotation.tokens[state.verbRef]?.text ?? '' : '';
  if (!chain) {
    // Defensive: the chain the verb pick relied on has vanished (shouldn't happen — the
    // annotation is immutable for the session). Bail out to a fresh pick rather than crash.
    return filStart({ drawn: state.drawn, correct: state.correct });
  }
  const group = groupText(annotation, chain, body);
  const num = numberWord(chain.features) ?? 'singulier';
  const isCorrect =
    annotIndex !== undefined && (chain.controller_group.includes(annotIndex) || annotIndex === chain.via_token);

  if (isCorrect) {
    const prefix = chain.via === 'qui' ? `« qui » reprend « ${group} ». ` : '';
    return {
      ...state,
      step: 'done',
      drawn: state.drawn + 1,
      correct: state.correct + 1,
      highlightSubject: chain.controller_group,
      message: `${prefix}Le fil est tendu : « ${verb} » ↔ « ${group} » (${num}). Vérifie la terminaison du verbe.`,
    };
  }

  if (state.attempts + 1 < MAX_ATTEMPTS) {
    return {
      ...state,
      attempts: state.attempts + 1,
      message: `Le fil ne tient pas. Le sujet, c'est qui fait l'action de « ${verb} ». Réessaie.`,
    };
  }

  return {
    ...state,
    step: 'done',
    drawn: state.drawn + 1,
    highlightSubject: chain.controller_group,
    message: `Le fil te guide : le sujet de « ${verb} », c'est « ${group} » (${num}).`,
  };
}

export function filTap(
  state: FilState,
  annotIndex: number | undefined,
  annotation: Annotation,
  body: string,
): FilState {
  switch (state.step) {
    case 'pick-verb':
      return pickVerb(state, annotIndex, annotation);
    case 'pick-subject':
      return pickSubject(state, annotIndex, annotation, body);
    case 'done':
      return filTap(filStart({ drawn: state.drawn, correct: state.correct }), annotIndex, annotation, body);
    case 'idle':
    default:
      return state;
  }
}
