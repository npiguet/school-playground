// The one mixer of the page (Ruling E1) and what keeps it in step with the page: the hero's channels,
// a hidden page (suspend), a shown page or a tap (resume, the iPad's `interrupted` state). In a
// browser it plays through Howler, unless an e2e page set __discordeAudioStub (Ruling E10): then it
// records, and publishes its state as window.__discordeAudio.
import { createEngine, type AudioEngine } from './engine';
import { howlerBackend } from './howlerBackend';
import { recordingBackend } from './recordingBackend';
import { snapshotAudio } from './store.svelte';

type TestWindow = Window & { __discordeAudioStub?: boolean; __discordeAudio?: { snapshot: AudioEngine['snapshot'] } };

let engine: AudioEngine | null = null;

export function audio(): AudioEngine {
  if (engine) return engine;
  const w = typeof window === 'undefined' ? null : (window as TestWindow);
  const recording = !w || w.__discordeAudioStub === true;
  const e = createEngine(recording ? recordingBackend() : howlerBackend());
  if (w && recording) w.__discordeAudio = { snapshot: () => e.snapshot() };
  engine = e;
  return e;
}

/** Called once from main.ts, before the app mounts. Returns its teardown (tests). */
export function installAudio(): () => void {
  const e = audio();
  const stopSync = $effect.root(() => {
    $effect(() => e.setSettings(snapshotAudio()));
  });
  const onVisibility = () => e.visibility(document.hidden);
  const onPoke = () => e.poke();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onVisibility);
  window.addEventListener('pointerdown', onPoke, { capture: true, passive: true });
  return () => {
    stopSync();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onVisibility);
    window.removeEventListener('pointerdown', onPoke, { capture: true });
  };
}
