// The one mixer of the page (Ruling E1) and what keeps it in step with the page: the hero's channels,
// a hidden page (suspend), a shown page or a tap (resume, the iPad's `interrupted` state), the
// battle's events (battleAudio.ts). In a browser it plays through Howler, loaded lazily (lane A
// review #12), unless an e2e page set __discordeAudioStub (Ruling E10): then it records, never loads
// Howler, and publishes its state as window.__discordeAudio.
import { listenToBattle } from './battleAudio';
import { createEngine, type AudioEngine } from './engine';
import { lazyBackend } from './lazyBackend';
import { recordingBackend } from './recordingBackend';
import { setAudioSink, snapshotAudio } from './store.svelte';

type TestWindow = Window & { __discordeAudioStub?: boolean; __discordeAudio?: { snapshot: AudioEngine['snapshot'] } };

let engine: AudioEngine | null = null;

export function audio(): AudioEngine {
  if (engine) return engine;
  const w = typeof window === 'undefined' ? null : (window as TestWindow);
  const recording = !w || w.__discordeAudioStub === true;
  const e = createEngine(recording ? recordingBackend() : lazyBackend(() => import('./howlerBackend').then((m) => m.howlerBackend())));
  if (w && recording) w.__discordeAudio = { snapshot: () => e.snapshot() };
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
  const onVisibility = () => withAudio((e) => e.visibility(document.hidden));
  const onPoke = () => withAudio((e) => e.poke());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onVisibility);
  window.addEventListener('pointerdown', onPoke, { capture: true, passive: true });
  return () => {
    setAudioSink(null);
    stopSync();
    stopBattle();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onVisibility);
    window.removeEventListener('pointerdown', onPoke, { capture: true });
  };
}
