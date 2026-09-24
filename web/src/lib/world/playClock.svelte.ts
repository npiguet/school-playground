// Tracks active play time (dictation + proofreading phases) so the dragon can suggest a break
// after ~25 minutes (spec §3.6, decision 16) - never a blocking timer, just a friendly nudge on
// the results screen. Session-scoped (sessionStorage): a reload keeps the count, a fresh tab does
// not, which is exactly right for a comfort feature with no guilt/streak angle. Purely a client
// convenience, not authoritative - all storage access wrapped in try/catch.
const KEY = 'discorde.playClock';
const BREAK_MS = 25 * 60_000;
const IDLE_RESET_MS = 10 * 60_000;

interface ClockState {
  activeMs: number;
  running: boolean;
  lastTick: number | null;
  lastStop: number | null;
}

function load(): ClockState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.activeMs === 'number') {
        // A fresh page load never resumes as "running": Play.svelte's own effect re-starts the
        // clock once it knows the restored phase is dictation/proofreading.
        return { activeMs: parsed.activeMs, running: false, lastTick: null, lastStop: parsed.lastStop ?? null };
      }
    }
  } catch {
    // Storage unavailable (private mode, quota) - start from zero.
  }
  return { activeMs: 0, running: false, lastTick: null, lastStop: null };
}

const state = $state(load());

function persist(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ activeMs: state.activeMs, lastStop: state.lastStop }));
  } catch {
    // Storage unavailable - non-fatal, the nudge just won't survive a reload.
  }
}

/** Read-only view: `activeMs` accumulates only while `clockStart()`-ed; `needsBreak` flips once
 *  25 minutes of active play have built up. Getters over the module's `$state` so a component
 *  reading `playClock.needsBreak` in its template stays reactive. */
export const playClock = {
  get activeMs(): number {
    return state.activeMs;
  },
  get needsBreak(): boolean {
    return state.activeMs >= BREAK_MS;
  },
};

/** Starts (or resumes) the clock. If it's been stopped for >= 10 idle minutes, the accumulated
 *  time is dropped first - a long-abandoned session shouldn't dump a stale 25 minutes on the
 *  child the moment they come back tomorrow. Also wires a `visibilitychange` listener so a
 *  backgrounded tab pauses the clock and a foregrounded one resumes it. */
export function clockStart(): void {
  // The idle-reset check needs a common time base with `clockTick`'s (possibly injected, in
  // tests) `now`, so it's evaluated on the next tick rather than here - see `clockTick`.
  state.running = true;
  state.lastTick = null;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
}

function onVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  if (document.hidden) clockStop();
  else clockStart();
}

/** Stops the clock, remembering the moment (in the same time base `clockTick` uses) so a later
 *  `clockStart()` can tell whether the player was away long enough to reset. */
export function clockStop(): void {
  state.running = false;
  state.lastStop = state.lastTick;
  persist();
}

/** Advances the clock to `now`. Accumulates elapsed time only while running; the first tick after
 *  a `clockStart()` (`lastTick === null`) never contributes elapsed time by itself (there's
 *  nothing to measure it against yet) but does check the idle-reset window - so a 10+ minute gap
 *  since the last stop (strictly greater: a resumption exactly 10 minutes later still counts as
 *  the same session) clears `activeMs` before counting continues. */
export function clockTick(now: number = Date.now()): void {
  if (state.running) {
    if (state.lastTick === null && state.lastStop !== null && now - state.lastStop > IDLE_RESET_MS) {
      state.activeMs = 0;
      state.lastStop = null;
    }
    if (state.lastTick !== null) {
      state.activeMs += now - state.lastTick;
    }
    state.lastTick = now;
  }
  persist();
}

/** Drops all accumulated time and stops the clock (a fresh play session, or the player dismissing
 *  the break nudge with "Encore un texte"). */
export function clockReset(): void {
  state.activeMs = 0;
  state.running = false;
  state.lastTick = null;
  state.lastStop = null;
  persist();
}
