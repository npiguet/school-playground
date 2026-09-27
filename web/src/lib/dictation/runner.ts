// Drives a dictation script (Task 8's `Step[]`) step by step: speaks `say`
// steps (through the server's voice, spec 2026-09-27), waits on `wait` steps,
// and stops on `manual` steps until the player calls `next()`. A line the
// voice could not say pauses the runner (`silenced`) until `retry()`. Pure
// state machine - `speak`/`sleep` are injected so this is unit-testable
// without the voice. Spec §3.3.
import { replayLimit, type Pace, type SayLine, type SayStep, type Step } from './script';
import type { VoiceFailure } from './voice';

export type RunnerStatus = 'idle' | 'playing' | 'waiting' | 'paused' | 'silenced' | 'finished';

export interface RunnerState {
  index: number;
  status: RunnerStatus;
  lastSay: SayStep | null;
  replaysLeft: number;
  done: number;
  total: number;
  /** UI4 Ruling M20: the step a resumed dictation starts from, the first step of the unit (a
   *  group, or the final whole-text reading) read last. */
  resumeAt: number;
  /** Spec 2026-09-27 §5.3: why the voice fell silent (the card's cause line), while `silenced`. */
  failure: VoiceFailure | null;
}

/** Whether `step` opens a unit of the reading: a group's first say (its second say belongs to it), or
 *  the first sentence of the final full reading (fix wave A, Ruling R-A1: the reading's other sentences
 *  belong to it, so a resumed dictation reads the whole text again). */
function opensUnit(step: Step | undefined): boolean {
  if (step?.kind !== 'say') return false;
  return step.unit === 'full' ? step.index === 0 : step.repeat === 1;
}

/** UI4 Ruling M20: the first step of the unit that `index` lies in (0 before the first one), so a
 *  resumed dictation reads that unit again from its start, never from the middle of a pause. */
export function unitStart(steps: Step[], index: number): number {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i--) if (opensUnit(steps[i])) return i;
  return 0;
}

/** The unit being read, for the progress line (paces review, Important 1): the line said last, from
 *  its first reading through its pauses (and « Suivant »), or, before the first line, the unit the
 *  runner starts at. The runner emits whenever a unit opens, so `state.lastSay` is never a unit behind. */
export function unitBeingRead(steps: Step[], state: RunnerState): SayStep | null {
  if (state.lastSay) return state.lastSay;
  const start = steps[state.resumeAt];
  return start?.kind === 'say' ? start : null;
}

export interface RunnerDeps {
  pace: Pace;
  // `next`: the line said after this one, fetched ahead once this one plays (null after the last).
  speak: (spoken: string, rate: number, next: SayLine | null) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  // Silences whatever is currently being spoken. Called by pause() and
  // stop() - the in-flight speak() promise from deps.speak may still resolve
  // later (or never), but the player must not keep hearing it.
  cancel: () => void;
  onChange: (s: RunnerState) => void;
}

/** The line said after step `index`, for the voice to fetch ahead (null: none left). */
function nextSay(steps: Step[], index: number): SayLine | null {
  for (let i = index + 1; i < steps.length; i++) {
    const s = steps[i];
    if (s.kind === 'say') return { spoken: s.spoken, rate: s.rate };
  }
  return null;
}

/** The cause a failed line carries (voice.ts's VoiceError), `server` when it carries none. */
function failureOf(e: unknown): VoiceFailure {
  const f = (e as { failure?: unknown } | null)?.failure;
  return f === 'unreachable' || f === 'server' ? f : 'server';
}

/** `from` (M20): a resumed dictation starts at that step's unit, its earlier units counted done.
 *  `fromReplaysLeft` (closing item 1): a resumed dictation keeps the replay its group had spent,
 *  instead of the pace's full allowance - undefined (a fresh dictation) still starts from
 *  `replayLimit`. « Suivant » gives the allowance back for the next group (the pace redesign). */
export function createRunner(steps: Step[], deps: RunnerDeps, from = 0, fromReplaysLeft?: number) {
  const counted = (s: Step): s is SayStep => s.kind === 'say' && s.repeat === 1 && s.unit === 'chunk';
  const total = steps.filter(counted).length;

  let index = from > 0 ? unitStart(steps, from) : 0;
  let resumeAt = index;
  let status: RunnerStatus = 'idle';
  let lastSay: SayStep | null = null;
  let replaysLeft = fromReplaysLeft ?? replayLimit(deps.pace);
  let done = steps.slice(0, index).filter(counted).length;
  let paused = false;
  let stopped = false;
  let failure: VoiceFailure | null = null;
  let silencedBy: 'loop' | 'replay' | null = null;
  /** The current run of runLoop (lane W review #1): an older run left off at a pause. */
  let runs = 0;

  function snapshot(): RunnerState {
    return { index, status, lastSay, replaysLeft, done, total, resumeAt, failure };
  }

  function emit() {
    if (stopped) return;
    deps.onChange(snapshot());
  }

  function silence(e: unknown, by: 'loop' | 'replay') {
    failure = failureOf(e);
    silencedBy = by;
    status = 'silenced';
    emit();
  }

  function sayAgain() {
    const say = lastSay!;
    deps.speak(say.spoken, say.rate, null).catch((e) => {
      if (stopped || status !== 'waiting') return;
      silence(e, 'replay');
    });
  }

  // Runs steps starting at `index` until a `manual` step (waits for next()),
  // a `done` step (finishes), or a pause/stop interrupts an in-flight
  // speak()/sleep(). Re-entrant: next()/resume() call it again from where it
  // left off. Each call is a new run (lane W review #1): a line or a wait from before a pause can
  // settle after resume() started the next run, and that stale run must leave off without touching
  // anything, so after every await it checks it is still the current one.
  async function runLoop() {
    const run = ++runs;
    const over = () => stopped || paused || run !== runs;
    paused = false;
    status = 'playing';
    emit();
    while (index < steps.length) {
      if (stopped) return;
      const step = steps[index];
      if (step.kind === 'say') {
        lastSay = step;
        if (opensUnit(step) && resumeAt !== index) {
          resumeAt = index;
          emit();
        }
        try {
          await deps.speak(step.spoken, step.rate, nextSay(steps, index));
        } catch (e) {
          if (over()) return;
          silence(e, 'loop'); // the same step is said again on retry()
          return;
        }
        if (over()) return;
        if (step.repeat === 1 && step.unit === 'chunk') done++;
        index++;
      } else if (step.kind === 'wait') {
        await deps.sleep(step.ms);
        if (over()) return;
        index++;
      } else if (step.kind === 'manual') {
        index++;
        status = 'waiting';
        emit();
        return;
      } else {
        status = 'finished';
        emit();
        return;
      }
    }
  }

  return {
    start() {
      if (stopped || status !== 'idle') return;
      void runLoop();
    },
    next() {
      if (stopped || status !== 'waiting') return;
      // The pace redesign: « Réécouter » is the group's (one at pace I), given back for the next one.
      replaysLeft = replayLimit(deps.pace);
      void runLoop();
    },
    replay() {
      if (stopped || status !== 'waiting' || !lastSay || replaysLeft <= 0) return;
      replaysLeft--;
      emit();
      sayAgain();
    },
    pause() {
      if (stopped || status !== 'playing') return;
      paused = true;
      status = 'paused';
      deps.cancel();
      emit();
    },
    resume() {
      if (stopped || status !== 'paused') return;
      void runLoop();
    },
    /** « Réessayer » on Éris's card: the line the voice could not say, again (a replay's without
     *  spending another replay), then on as before. */
    retry() {
      if (stopped || status !== 'silenced') return;
      failure = null;
      const by = silencedBy;
      silencedBy = null;
      if (by === 'replay') {
        status = 'waiting';
        emit();
        sayAgain();
      } else {
        void runLoop();
      }
    },
    stop() {
      stopped = true;
      deps.cancel();
    },
    state: snapshot,
  };
}
