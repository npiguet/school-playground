// Drives a dictation script (Task 8's `Step[]`) step by step: speaks `say`
// steps, waits on `wait` steps, and stops on `manual` steps until the player
// calls `next()`. Pure state machine - `speak`/`sleep` are injected so this
// is unit-testable without the Web Speech API. Spec §3.3.
import { replayLimit, type Pace, type SayStep, type Step } from './script';

export type RunnerStatus = 'idle' | 'playing' | 'waiting' | 'paused' | 'finished';

export interface RunnerState {
  index: number;
  status: RunnerStatus;
  lastSay: SayStep | null;
  replaysLeft: number;
  done: number;
  total: number;
  /** UI4 Ruling M20: the step a resumed dictation starts from, the first step of the unit (a
   *  sentence, a chunk, or pace 4's whole-text read) read last. */
  resumeAt: number;
}

/** Whether `step` opens a unit of the reading (its first say; a chunk's second say belongs to it). */
function opensUnit(step: Step | undefined): boolean {
  return step?.kind === 'say' && (step.repeat === 1 || step.unit === 'full');
}

/** UI4 Ruling M20: the first step of the unit that `index` lies in (0 before the first one), so a
 *  resumed dictation reads that unit again from its start, never from the middle of a pause. */
export function unitStart(steps: Step[], index: number): number {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i--) if (opensUnit(steps[i])) return i;
  return 0;
}

export interface RunnerDeps {
  pace: Pace;
  speak: (spoken: string, rate: number) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  // Silences whatever is currently being spoken. Called by pause() and
  // stop() - the in-flight speak() promise from deps.speak may still resolve
  // later (or never), but the player must not keep hearing it.
  cancel: () => void;
  onChange: (s: RunnerState) => void;
}

/** `from` (M20): a resumed dictation starts at that step's unit, its earlier units counted done. */
export function createRunner(steps: Step[], deps: RunnerDeps, from = 0) {
  const counted = (s: Step): s is SayStep => s.kind === 'say' && s.repeat === 1 && s.unit === 'chunk';
  const total = steps.filter(counted).length;

  let index = from > 0 ? unitStart(steps, from) : 0;
  let resumeAt = index;
  let status: RunnerStatus = 'idle';
  let lastSay: SayStep | null = null;
  let replaysLeft = replayLimit(deps.pace);
  let done = steps.slice(0, index).filter(counted).length;
  let paused = false;
  let stopped = false;

  function snapshot(): RunnerState {
    return { index, status, lastSay, replaysLeft, done, total, resumeAt };
  }

  function emit() {
    if (stopped) return;
    deps.onChange(snapshot());
  }

  // Runs steps starting at `index` until a `manual` step (waits for next()),
  // a `done` step (finishes), or a pause/stop interrupts an in-flight
  // speak()/sleep(). Re-entrant: next()/resume() call it again from where it
  // left off.
  async function runLoop() {
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
        await deps.speak(step.spoken, step.rate);
        if (stopped || paused) return;
        if (step.repeat === 1 && step.unit === 'chunk') done++;
        index++;
      } else if (step.kind === 'wait') {
        await deps.sleep(step.ms);
        if (stopped || paused) return;
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
      void runLoop();
    },
    replay() {
      if (stopped || status !== 'waiting' || !lastSay || replaysLeft <= 0) return;
      replaysLeft--;
      emit();
      void deps.speak(lastSay.spoken, lastSay.rate);
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
    stop() {
      stopped = true;
      deps.cancel();
    },
    state: snapshot,
  };
}
