// Howler arrives by a dynamic import (lane A review #12): an e2e page (the recording backend) never
// loads it, and a player's page starts fetching it as soon as the mixer is made, well before the
// first tap. Until it is there, what the engine asks is kept and replayed: the context's last wish
// (running or suspended), the effects' warm-up and each loop still wanted, at its latest gain.
// Effects asked meanwhile are dropped (they are short cues, late is worse than never).
import type { AudioBackend, ContextState, TrackHandle } from './engine';
import type { TrackId } from './catalog';

interface Pending {
  id: TrackId;
  started: { gain: number; ms: number } | null;
  stopped: boolean;
  real: TrackHandle | null;
}

export function lazyBackend(load: () => Promise<AudioBackend>): AudioBackend {
  let backend: AudioBackend | null = null;
  let warm = false;
  let context: 'resume' | 'suspend' | null = null;
  const pending: Pending[] = [];

  load()
    .then((b) => {
      backend = b;
      if (warm) b.warm();
      if (context === 'resume') b.resume();
      else if (context === 'suspend') b.suspend();
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
      if (backend) backend.resume();
      else context = 'resume';
    },
    suspend() {
      if (backend) backend.suspend();
      else context = 'suspend';
    },
    state(): ContextState {
      return backend ? backend.state() : 'none';
    },
  };
}
