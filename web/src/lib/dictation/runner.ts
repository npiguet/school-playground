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

export function createRunner(steps: Step[], deps: RunnerDeps) {
  const total = steps.filter(
    (s): s is SayStep => s.kind === 'say' && s.repeat === 1 && s.unit === 'chunk',
  ).length;

  let index = 0;
  let status: RunnerStatus = 'idle';
  let lastSay: SayStep | null = null;
  let replaysLeft = replayLimit(deps.pace);
  let done = 0;
  let paused = false;
  let stopped = false;

  function snapshot(): RunnerState {
    return { index, status, lastSay, replaysLeft, done, total };
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
