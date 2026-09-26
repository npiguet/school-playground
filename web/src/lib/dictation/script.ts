// Builds the sequence of speech/wait steps a dictation runs through for a
// given pace level. Pure TypeScript, spec §3.3.
import { splitSentences, splitChunks, countWords, type Sentence } from './segment';
import { spokenForm } from './spoken';

export type Pace = 1 | 2 | 3 | 4;

export const PACE_RATES: Record<Pace, number> = { 1: 0.75, 2: 0.85, 3: 0.9, 4: 1.0 };

export const PACE_LABELS: Record<Pace, { title: string; description: string }> = {
  1: { title: 'Pas à pas', description: 'Une phrase à la fois, lentement. Tu réécoutes autant que tu veux.' },
  2: { title: 'Par groupes', description: 'Des groupes de mots, trois réécoutes pour tout le texte.' },
  3: { title: "D'un bon pas", description: 'Chaque groupe est lu deux fois, puis la voix enchaîne.' },
  4: { title: "D'une traite", description: 'Le texte entier est lu, puis dicté, puis relu une dernière fois. Pas de réécoute.' },
};

export interface Chunk {
  text: string;
  spoken: string;
  sentenceIndex: number;
  newParagraph: boolean;
}

export interface DictationPlan {
  sentences: Sentence[];
  chunks: Chunk[];
  full: string;
}

export type Step =
  | {
      kind: 'say';
      text: string;
      spoken: string;
      rate: number;
      label: 'full' | 'sentence' | 'chunk';
      // Whether this step counts toward the runner's done/total progress:
      // 'chunk' for the countable units (sentences at pace 1, chunks at
      // paces 2-4), 'full' for pace 4's whole-text bookend reads, which are
      // not part of the "Groupe X sur Y" count.
      unit: 'chunk' | 'full';
      index: number;
      repeat: 1 | 2;
    }
  | { kind: 'wait'; ms: number }
  | { kind: 'manual'; index: number }
  | { kind: 'done' };

// Task 10's runner.ts imports this for RunnerState.lastSay.
export type SayStep = Extract<Step, { kind: 'say' }>;

export function buildPlan(text: string): DictationPlan {
  const sentences = splitSentences(text);
  const chunks: Chunk[] = [];
  sentences.forEach((sentence, sentenceIndex) => {
    const chunkTexts = splitChunks(sentence.text);
    chunkTexts.forEach((chunkText) => {
      chunks.push({
        text: chunkText,
        spoken: spokenForm(chunkText, { newParagraph: sentence.newParagraph }),
        sentenceIndex,
        newParagraph: sentence.newParagraph,
      });
    });
  });
  const full = sentences.map((s) => spokenForm(s.text, { newParagraph: s.newParagraph })).join(' ');
  return { sentences, chunks, full };
}

export function replayLimit(pace: Pace): number {
  return { 1: Infinity, 2: 3, 3: 0, 4: 0 }[pace];
}

export function pauseMs(chunkText: string): number {
  return Math.max(3000, 1800 * countWords(chunkText));
}

export function defaultPace(level: string): Pace {
  if (level === '5H' || level === '6H') return 1;
  if (level === '7H' || level === '8H') return 2;
  return 3;
}

export function buildScript(plan: DictationPlan, pace: Pace): Step[] {
  const steps: Step[] = [];

  if (pace === 1) {
    plan.sentences.forEach((sentence, i) => {
      steps.push({
        kind: 'say',
        text: sentence.text,
        spoken: spokenForm(sentence.text, { newParagraph: sentence.newParagraph }),
        rate: PACE_RATES[1],
        label: 'sentence',
        unit: 'chunk',
        index: i,
        repeat: 1,
      });
      steps.push({ kind: 'manual', index: i });
    });
  } else if (pace === 2) {
    plan.chunks.forEach((chunk, i) => {
      steps.push({
        kind: 'say',
        text: chunk.text,
        spoken: chunk.spoken,
        rate: PACE_RATES[2],
        label: 'chunk',
        unit: 'chunk',
        index: i,
        repeat: 1,
      });
      steps.push({ kind: 'manual', index: i });
    });
  } else if (pace === 3) {
    plan.chunks.forEach((chunk, i) => {
      pushChunkTwice(steps, chunk, i, PACE_RATES[3]);
    });
  } else {
    steps.push({
      kind: 'say',
      text: plan.sentences.map((s) => s.text).join(' '),
      spoken: plan.full,
      rate: PACE_RATES[4],
      label: 'full',
      unit: 'full',
      index: 0,
      repeat: 1,
    });
    steps.push({ kind: 'wait', ms: 2000 });
    plan.chunks.forEach((chunk, i) => {
      pushChunkTwice(steps, chunk, i, PACE_RATES[3]);
    });
    steps.push({ kind: 'wait', ms: 1000 });
    steps.push({
      kind: 'say',
      text: plan.sentences.map((s) => s.text).join(' '),
      spoken: plan.full,
      rate: 0.95,
      label: 'full',
      unit: 'full',
      index: 0,
      repeat: 2,
    });
  }

  steps.push({ kind: 'done' });
  return steps;
}

function pushChunkTwice(steps: Step[], chunk: Chunk, index: number, rate: number): void {
  steps.push({ kind: 'say', text: chunk.text, spoken: chunk.spoken, rate, label: 'chunk', unit: 'chunk', index, repeat: 1 });
  steps.push({ kind: 'wait', ms: 600 });
  steps.push({ kind: 'say', text: chunk.text, spoken: chunk.spoken, rate, label: 'chunk', unit: 'chunk', index, repeat: 2 });
  steps.push({ kind: 'wait', ms: pauseMs(chunk.text) });
}
