// Howler arrives by a dynamic import (lane A review #12): an e2e page (the recording backend) never
// loads it, and a player's page starts fetching it at startup (main.ts → installAudio → audio()),
// long before « Entrer ». Until it is there, what the engine asks is kept and replayed: the context's last wish
// (running or suspended), the effects' warm-up and each loop still wanted, at its latest gain.
// Effects asked meanwhile are dropped (they are short cues, late is worse than never).
import { silentLine, type AudioBackend, type ContextState, type LineHandle, type TrackHandle, type VoiceClip } from './engine';
import type { TrackId } from './catalog';
import { onNextGesture } from './gestures';

interface Pending {
  id: TrackId;
  started: { gain: number; ms: number } | null;
  stopped: boolean;
  real: TrackHandle | null;
}

/** The next completed tap or key press anywhere, once (the default: the page's own). Final review I3:
 *  on the events that end a gesture (gestures.ts), never a finger's pointerdown. */
function nextGesture(fn: () => void): void {
  if (typeof window === 'undefined') return;
  onNextGesture(window, fn);
}

export function lazyBackend(load: () => Promise<AudioBackend>, onNextGesture: (fn: () => void) => void = nextGesture): AudioBackend {
  let backend: AudioBackend | null = null;
  let warm = false;
  let context: 'resume' | 'suspend' | null = null;
  const pending: Pending[] = [];

  load()
    .then((b) => {
      backend = b;
      if (warm) b.warm();
      if (context === 'resume') {
        b.resume();
        // The unlock's tap came before Howler: its context is born outside a gesture, and iOS
        // keeps it suspended until one. The next tap anywhere resumes it (Howler's autoUnlock does
        // the same; this does not depend on it).
        if (b.state() !== 'running') {
          onNextGesture(() => {
            if (backend && context === 'resume' && backend.state() !== 'running') backend.resume();
          });
        }
      } else if (context === 'suspend') b.suspend();
      for (const p of pending) {
        if (p.stopped || !p.started) continue;
        p.real = b.track(p.id);
        p.real.start(p.started.gain, p.started.ms);
      }
      pending.length = 0;
    })
    .catch(() => {
      // No sound this time: the game goes on silent.
    });

  return {
    track(id) {
      if (backend) return backend.track(id);
      const p: Pending = { id, started: null, stopped: false, real: null };
      pending.push(p);
      return {
        start(gain, ms) {
          if (p.real) p.real.start(gain, ms);
          else p.started = { gain, ms };
        },
        fadeTo(gain, ms) {
          if (p.real) p.real.fadeTo(gain, ms);
          else if (p.started) p.started = { ...p.started, gain };
        },
        stop(ms) {
          if (p.real) p.real.stop(ms);
          else p.stopped = true;
        },
      };
    },
    sfx(id, gain) {
      backend?.sfx(id, gain);
    },
    warm() {
      if (backend) backend.warm();
      else warm = true;
    },
    resume() {
      context = 'resume';
      backend?.resume();
    },
    suspend() {
      context = 'suspend';
      backend?.suspend();
    },
    state(): ContextState {
      return backend ? backend.state() : 'none';
    },
    // A line asked before Howler arrived is silent at its length (short, and late is worse than never).
    line(clip: VoiceClip, gain: number): LineHandle {
      return backend ? backend.line(clip, gain) : silentLine(clip.ms);
    },
  };
}
