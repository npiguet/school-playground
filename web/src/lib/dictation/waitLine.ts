// The Pythia's waiting line (spec 2026-09-27 §5.2, fix wave B ruling 1): what the status says while a
// line is late. The voice calls `slow()` once a line is SLOW_MS late; the opener shows, and if the
// line is still not there WAIT_LONG_MS after it was asked for, a second line takes over, so a long
// wait never reads as one frozen sentence. Once shown, a line stays at least WAIT_HOLD_MS, even if the
// voice starts meanwhile (the words may trail the sound, never flash by): `done()` waits out the rest.
// `clear()` takes it down at once (a pause, the voice silenced, the page left).
import { SLOW_MS } from './voice';

/** How long a waiting line stays up once shown, at least. */
export const WAIT_HOLD_MS = 800;
/** From the line's ask: past this, the second waiting line. */
export const WAIT_LONG_MS = 5_000;

export type WaitKey = 'battle.voice.wait' | 'battle.voice.waitLong';

export interface WaitLine {
  /** The line is SLOW_MS late: the opener shows (the one already up stays). */
  slow(): void;
  /** The line has started, or given up: the waiting line goes once it has been up WAIT_HOLD_MS. */
  done(): void;
  /** The waiting line goes now. */
  clear(): void;
}

export function createWaitLine(
  show: (text: string | null) => void,
  pick: (key: WaitKey) => string,
  now: () => number = Date.now,
): WaitLine {
  let shownAt: number | null = null;
  let longer: ReturnType<typeof setTimeout> | null = null;
  let hiding: ReturnType<typeof setTimeout> | null = null;

  function stopTimers() {
    if (longer) clearTimeout(longer);
    if (hiding) clearTimeout(hiding);
    longer = hiding = null;
  }

  function clear() {
    stopTimers();
    if (shownAt !== null) show(null);
    shownAt = null;
  }

  return {
    slow() {
      stopTimers();
      if (shownAt === null) {
        shownAt = now();
        show(pick('battle.voice.wait'));
      }
      longer = setTimeout(() => {
        longer = null;
        show(pick('battle.voice.waitLong'));
      }, WAIT_LONG_MS - SLOW_MS);
    },
    done() {
      if (longer) clearTimeout(longer);
      longer = null;
      if (shownAt === null || hiding) return;
      const left = WAIT_HOLD_MS - (now() - shownAt);
      if (left <= 0) {
        clear();
        return;
      }
      hiding = setTimeout(clear, left);
    },
    clear,
  };
}
