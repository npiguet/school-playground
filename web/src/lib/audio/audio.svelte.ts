// The one mixer of the page (Ruling E1) and what keeps it in step with the page: the hero's channels,
// a hidden page (suspend), a shown page or a tap (the first one unlocks, Ruling E3b; later ones
// resume, the iPad's `interrupted` state), the
// battle's events (battleAudio.ts). In a browser it plays through Howler, loaded lazily (lane A
// review #12), unless an e2e page set __discordeAudioStub (Ruling E10): then it records, never loads
// Howler, and publishes its state as window.__discordeAudio.
import { listenToBattle } from './battleAudio';
import { createEngine, type AudioEngine, type ContextState } from './engine';
import { onEveryGesture } from './gestures';
import { lazyBackend } from './lazyBackend';
import { recordingBackend } from './recordingBackend';
import { flushPendingAudioSave, setAudioSink, snapshotAudio } from './store.svelte';

/** What an e2e page reads (Ruling E10): the engine's state, and the recorded context's, which a spec
 *  can set to `interrupted` as a phone call would (final review I3). */
export interface AudioProbe {
  snapshot: AudioEngine['snapshot'];
  context(): ContextState;
  interrupt(): void;
}
type TestWindow = Window & { __discordeAudioStub?: boolean; __discordeAudio?: AudioProbe };

let engine: AudioEngine | null = null;

export function audio(): AudioEngine {
  if (engine) return engine;
  const w = typeof window === 'undefined' ? null : (window as TestWindow);
  const recorder = !w || w.__discordeAudioStub === true ? recordingBackend() : null;
  const e = createEngine(recorder ?? lazyBackend(() => import('./howlerBackend').then((m) => m.howlerBackend())));
  if (w && recorder) {
    w.__discordeAudio = {
      snapshot: () => e.snapshot(),
      context: () => recorder.log.state,
      interrupt: () => {
        recorder.log.state = 'interrupted';
      },
    };
  }
  engine = e;
  return e;
}

/** Every call into the mixer from a component, an effect or a listener goes through here: sound is a
 *  convenience, and a mixer bug must never break a scene (lane A review #9). */
export function withAudio(fn: (e: AudioEngine) => void): void {
  try {
    fn(audio());
  } catch {
    // Silent: the game goes on without that sound.
  }
}

/** Called once from main.ts, before the app mounts. Returns its teardown (tests). */
export function installAudio(): () => void {
  // The mixer is made here, at startup: on a player's page that starts Howler's import now, long
  // before « Entrer » (lazyBackend also covers a late arrival: the next tap resumes the context).
  withAudio(() => undefined);
  // A channel changed from a control reaches the mixer at once, inside the same tap (review #5: the
  // confirming effect after unmuting the effects was dropped); the effect below covers the rest (a
  // hero's settings seeded on load).
  setAudioSink((s) => withAudio((e) => e.setSettings(s)));
  const stopSync = $effect.root(() => {
    $effect(() => {
      const s = snapshotAudio();
      withAudio((e) => e.setSettings(s));
    });
  });
  let stopBattle = (): void => undefined;
  withAudio((e) => (stopBattle = listenToBattle(e)));
  const onVisibility = () => {
    // Final review M1: a slider's save still waiting to rest is not lost to a reload or a closed tab.
    if (document.hidden) flushPendingAudioSave();
    withAudio((e) => e.visibility(document.hidden));
  };
  const onPageHide = () => flushPendingAudioSave();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  // Ruling E3b and final review I3: a completed gesture anywhere (gestures.ts) unlocks the mixer
  // after a reload, and resumes a context the iPad suspended or interrupted.
  const stopGestures = onEveryGesture(window, () => withAudio((e) => e.gesture()));
  return () => {
    setAudioSink(null);
    stopSync();
    stopBattle();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    stopGestures();
  };
}
