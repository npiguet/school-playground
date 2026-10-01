// Builds the sequence of speech/wait steps a dictation runs through for a
// given pace level. Pure TypeScript, spec §3.3, as redesigned on 2026-09-27
// (pace-redesign-brief.md): three paces, all in breath groups, each group
// read twice, the whole text read once at the end.
import { splitSentences, splitChunks, countWords, type Sentence } from './segment';
import { spokenForm } from './spoken';

/** I « Pas à pas », II « Par groupes », III « D'un bon pas ». Pace IV (« D'une traite ») was retired by
 *  the pace redesign: a save or a setting that still holds it reads as III (`toPace`); the server keeps
 *  4 valid for the sessions recorded at it. */
export type Pace = 1 | 2 | 3;

export const PACES: readonly Pace[] = [1, 2, 3];

/** The pace a saved state holds: 1-3 as they are, the retired 4 as 3, anything else null (corrupt). */
export function toPace(value: unknown): Pace | null {
  if (value === 1 || value === 2 || value === 3) return value;
  return value === 4 ? 3 : null;
}

/** Every line of every pace is said at this rate (the pace redesign: the paces differ in their groups
 *  and their stops, not in the voice's speed). */
export const DICTATION_RATE = 0.85;

export const PACE_LABELS: Record<Pace, { title: string; description: string }> = {
  1: { title: 'Pas à pas', description: "Chaque groupe est lu deux fois, puis la Pythie t'attend. Une réécoute par groupe." },
  2: { title: 'Par groupes', description: 'Chaque groupe est lu deux fois, puis la Pythie enchaîne. Tu peux faire une pause.' },
  3: { title: "D'un bon pas", description: 'Des groupes plus longs, lus deux fois, sans bouton pause\u202f: la Pythie enchaîne.' },
};

export interface Chunk {
  text: string;
  spoken: string;
  sentenceIndex: number;
  /** The chunk opens a paragraph: the first group of a sentence that starts one. */
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
      label: 'full' | 'chunk';
      // Whether this step counts toward the runner's done/total progress: 'chunk' for the breath
      // groups, 'full' for the final whole-text reading, which is not part of the "Groupe X sur Y" count.
      unit: 'chunk' | 'full';
      // The group, or, in the final reading, its sentence (fix wave A, Ruling R-A1: the reading's first
      // sentence, 0, opens its unit).
      index: number;
      repeat: 1 | 2;
    }
  | { kind: 'wait'; ms: number }
  | { kind: 'manual'; index: number }
  | { kind: 'done' };

// Task 10's runner.ts imports this for RunnerState.lastSay.
export type SayStep = Extract<Step, { kind: 'say' }>;

/** One line the voice says: its spoken form and its rate (the cache and the prefetch key on both). */
export interface SayLine {
  spoken: string;
  rate: number;
}

/** The voice's limit on one line (tts/app/text.py MAX_CHARS, Kokoro plan Ruling K1), kept as a guard:
 *  the longest line the game says is one sentence (the final reading, said a sentence at a time since
 *  fix wave A's Ruling R-A1). */
export const MAX_LINE_CHARS = 10_000;

/** What makes two lines the same line: its rate and its spoken form (sayLines' dedupe and the voice's
 *  clip cache; both must agree for the prefetch, the replay and the prepare to line up). */
export const lineKey = (rate: number, spoken: string): string => `${rate}|${spoken}`;

/** The lines a script says, each once, in the order it first says them (spec 2026-09-27 §5.2: what the
 *  dictation sends ahead to be recorded). */
export function sayLines(steps: Step[]): SayLine[] {
  const seen = new Set<string>();
  const out: SayLine[] = [];
  for (const s of steps) {
    if (s.kind !== 'say') continue;
    const key = lineKey(s.rate, s.spoken);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ spoken: s.spoken, rate: s.rate });
  }
  return out;
}

export function buildPlan(text: string): DictationPlan {
  const sentences = splitSentences(text);
  const chunks: Chunk[] = [];
  sentences.forEach((sentence, sentenceIndex) => {
    const chunkTexts = splitChunks(sentence.text);
    chunkTexts.forEach((chunkText, i) => {
      // Only the sentence's first group opens its paragraph: « À la ligne » is said once, not before
      // each group of the sentence.
      const newParagraph = sentence.newParagraph && i === 0;
      chunks.push({
        text: chunkText,
        // A group before the sentence's last goes on (spoken.ts: no full stop after a word).
        spoken: spokenForm(chunkText, { newParagraph, continues: i < chunkTexts.length - 1 }),
        sentenceIndex,
        newParagraph,
      });
    });
  });
  const full = sentences.map((s) => spokenForm(s.text, { newParagraph: s.newParagraph })).join(' ');
  return { sentences, chunks, full };
}

/** The most words a pace III group holds once its neighbours are merged in. */
const LONG_GROUP_WORDS = 20;

/** Pace III's breath groups, about twice as long (the pace redesign): the plan's groups, each merged
 *  with the next, left to right, while the merged group stays at 20 words or fewer. Never across a
 *  sentence. The merged group keeps the second group's ending: a group that goes on still ends on a
 *  comma, a sentence's last still ends « . Point. ». */
export function longGroups(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  let current: Chunk | null = null;
  const flush = (lastOfSentence: boolean) => {
    if (!current) return;
    out.push({ ...current, spoken: spokenForm(current.text, { newParagraph: current.newParagraph, continues: !lastOfSentence }) });
    current = null;
  };
  chunks.forEach((chunk, i) => {
    if (current && countWords(current.text) + countWords(chunk.text) <= LONG_GROUP_WORDS) {
      current = { ...current, text: `${current.text} ${chunk.text}` };
    } else {
      flush(false);
      current = { ...chunk };
    }
    const next = chunks[i + 1];
    if (!next || next.sentenceIndex !== chunk.sentenceIndex) flush(true);
  });
  return out;
}

/** « Réécouter »: one extra reading of the group at pace I, given back at each new group; none at II
 *  and III, which move on by themselves. */
export function replayLimit(pace: Pace): number {
  return pace === 1 ? 1 : 0;
}

/** The pause after a group's first reading: she has only just started writing it. */
export function longPauseMs(groupText: string): number {
  return Math.max(3000, 1600 * countWords(groupText));
}

/** The pause after its second reading: she finishes it, and checks it. */
export function shortPauseMs(groupText: string): number {
  return Math.max(2000, 800 * countWords(groupText));
}

export function defaultPace(level: string): Pace {
  if (level === '5H' || level === '6H') return 1;
  if (level === '7H' || level === '8H') return 2;
  return 3;
}

/** The pace redesign: each group twice (the long pause, then the short one); pace I then waits for
 *  « Suivant »; II and III move on. III reads longer groups. The whole text once at the end. */
export function buildScript(plan: DictationPlan, pace: Pace): Step[] {
  const steps: Step[] = [];
  const groups = pace === 3 ? longGroups(plan.chunks) : plan.chunks;
  groups.forEach((group, i) => {
    const say = (repeat: 1 | 2): Step => ({
      kind: 'say',
      text: group.text,
      spoken: group.spoken,
      rate: DICTATION_RATE,
      label: 'chunk',
      unit: 'chunk',
      index: i,
      repeat,
    });
    steps.push(say(1), { kind: 'wait', ms: longPauseMs(group.text) }, say(2), { kind: 'wait', ms: shortPauseMs(group.text) });
    if (pace === 1) steps.push({ kind: 'manual', index: i });
  });
  pushFullReading(steps, plan);
  steps.push({ kind: 'done' });
  return steps;
}

/** The final whole-text reading (fix wave A, Ruling R-A1): its sentences back to back, each its own
 *  line, with no gap but the voice's own. The first is ready in about a second, where the whole text as
 *  one line took 23 to 26 s. The same words as `plan.full`, which joins them. */
function pushFullReading(steps: Step[], plan: DictationPlan): void {
  plan.sentences.forEach((sentence, i) => {
    steps.push({
      kind: 'say',
      text: sentence.text,
      spoken: spokenForm(sentence.text, { newParagraph: sentence.newParagraph }),
      rate: DICTATION_RATE,
      label: 'full',
      unit: 'full',
      index: i,
      repeat: 1,
    });
  });
}
