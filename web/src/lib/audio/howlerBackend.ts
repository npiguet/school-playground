// The browser backend (Rulings E3, E9): Howler over Web Audio, whose single AudioContext is the only
// one in the app. A loop is loaded by a probe; once its decoded length is known, a sprite region
// (sample-accurate loopStart/loopEnd) skips the AAC priming when the browser kept it. The second
// Howl of the same file reuses Howler's decoded-buffer cache (no second fetch, no second decode).
// A file that cannot load (not there yet, a bad decode) stays silent: one note in dev, never a throw.
import { Howl, Howler } from 'howler';
import META from './meta.gen.json';
import { SFX, SFX_IDS, TRACKS, type SfxId } from './catalog';
import { loopRegion, type LoopMeta } from './loop';
import type { AudioBackend, ContextState } from './engine';

const noted = new Set<string>();
/** A gain change smaller than this is not faded (inaudible, and Howler never ends a no-op fade). */
const FADE_EPSILON = 0.005;

/** Sound is a convenience, never a blocker: a missing file is noted once per page, in dev only. */
function missing(src: string): void {
  if (!import.meta.env.DEV || noted.has(src)) return;
  noted.add(src);
  console.info(`[audio] ${src} could not load; it stays silent.`);
}

export function howlerBackend(): AudioBackend {
  // Final review M5: the engine owns the context's life (suspend when the page hides, resume on a
  // tap or when it shows). Howler's own 30 s idle suspend would be a second owner, and its
  // `Howler.state` would go stale.
  Howler.autoSuspend = false;
  const effects = new Map<SfxId, Howl>();
  const broken = new Set<SfxId>();
  // Final review M4: the loops still fading out, oldest first, each with its own release. At most
  // one outgoing crossfade is kept when a new loop starts: quick hops across places never hold
  // three decoded loops (about 20-24 MB each).
  const outgoing: (() => void)[] = [];
  const effect = (id: SfxId): Howl => {
    let h = effects.get(id);
    if (!h) {
      const src = SFX[id].src;
      h = new Howl({ src: [src], preload: true });
      h.once('loaderror', () => {
        broken.add(id);
        missing(src);
      });
      effects.set(id, h);
    }
    return h;
  };

  return {
    track(id) {
      while (outgoing.length > 1) outgoing[0]();
      const src = TRACKS[id].src;
      let loop: Howl | null = null;
      let sound: number | null = null;
      let target = 0;
      let fadeIn = 0;
      let gone = false;
      const probe = new Howl({ src: [src], preload: true });
      probe.once('load', () => {
        if (gone) {
          probe.unload();
          return;
        }
        const [start, length] = loopRegion(probe.duration(), (META as Record<string, LoopMeta>)[id]);
        loop = new Howl({ src: [src], sprite: { loop: [start * 1000, length * 1000, true] }, volume: 0 });
        sound = loop.play('loop');
        loop.fade(0, target, fadeIn, sound);
      });
      probe.once('loaderror', () => {
        missing(src);
        probe.unload();
      });
      return {
        start(gain, ms) {
          target = gain;
          fadeIn = ms;
        },
        fadeTo(gain, ms) {
          target = gain;
          if (!loop || sound === null) return;
          const from = loop.volume(sound) as number;
          // Howler never completes a fade to the volume a sound already has; nothing to do anyway.
          if (Math.abs(from - gain) < FADE_EPSILON) return;
          loop.fade(from, gain, ms, sound);
        },
        stop(ms) {
          gone = true;
          if (!loop || sound === null) return; // still loading: the load handler frees the probe
          const l = loop;
          const s = sound;
          // Freed on a timer, not on Howler's 'fade' event (lane A review #1): Howler fires 'fade' at
          // once when it interrupts a running fade (a hard cut) and never for a fade from 0 to 0 (a
          // silent loop left decoded in memory).
          l.fade(l.volume(s) as number, 0, ms, s);
          let freed = false;
          const free = () => {
            if (freed) return;
            freed = true;
            outgoing.splice(outgoing.indexOf(free), 1);
            l.unload();
            probe.unload();
          };
          outgoing.push(free);
          setTimeout(free, ms + 50);
        },
      };
    },
    sfx(id, gain) {
      const h = effect(id);
      // Final review M12: an effect whose file is not loaded yet (a tap right at « Entrer », before
      // the warm-up is done) is dropped, never queued by Howler to play late.
      if (broken.has(id) || h.state() !== 'loaded') return;
      const s = h.play();
      h.volume(gain, s);
    },
    warm() {
      for (const id of SFX_IDS) effect(id);
    },
    resume() {
      void Howler.ctx?.resume?.().catch(() => undefined);
    },
    suspend() {
      void Howler.ctx?.suspend?.().catch(() => undefined);
    },
    state(): ContextState {
      return (Howler.ctx?.state as ContextState | undefined) ?? 'none';
    },
  };
}
