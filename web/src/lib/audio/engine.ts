// The mixer (scenes UI spec §7, Rulings E3-E6): one loop at a time on the music channel, short
// effects on the sfx channel, and the dictation's voice (a line at a time, fetched from the server by
// lib/dictation/voice.ts), so the music ducks under it and no effect talks over it. Backend-agnostic:
// Howler in the browser (howlerBackend.ts), a recorder in vitest and in every e2e run
// (recordingBackend.ts). Nothing plays before `unlock()`, which a tap calls (iOS only lets a gesture
// start audio); a loop asked for earlier waits for it.
import { SFX, TRACKS, type SfxId, type TrackId } from './catalog';
import { DEFAULT_AUDIO, gainOf, type AudioSettings } from './settings';

export type DuckReason = 'voice' | 'dictation' | 'proofreading';
export type ContextState = 'running' | 'suspended' | 'interrupted' | 'closed' | 'none';

export const DUCK_GAIN = 0.3;
export const FADE_MS = 400;
export const CROSSFADE_MS = 1200;
export const SETTINGS_FADE_MS = 150;
export const SFX_REPEAT_MS = 80;
/** How long the music stays ducked after a line of the voice ends (fix wave A, Ruling R-A2): the next
 *  line, if it comes by then, keeps it down, so the final reading's sentences said back to back do not make the
 *  music pump, and no effect slips into the gap between them. */
export const VOICE_RELEASE_MS = 300;

export interface TrackHandle {
  /** Starts the loop silent and fades it up to `gain` (at once if it is still loading: when ready). */
  start(gain: number, fadeMs: number): void;
  fadeTo(gain: number, fadeMs: number): void;
  /** Fades out, then stops and frees the loop (a loop still loading never starts). */
  stop(fadeMs: number): void;
}

/** A line of the dictation's voice: its audio (a blob URL of the server's MP3), its text (the e2e
 *  recorder writes it down) and its estimated length (voice.ts `speechMs`: a silent line's length and the
 *  Howler backend's watchdog, Ruling K7). */
export interface VoiceClip {
  url: string;
  text: string;
  ms: number;
}
export interface LineHandle {
  ended: Promise<void>;
  stop(): void;
  volume(gain: number): void;
}

/** A line nobody hears (before the unlock, Ruling K14; Howler not there yet): it takes its length. */
export function silentLine(ms: number): LineHandle {
  let done!: () => void;
  const ended = new Promise<void>((resolve) => (done = resolve));
  const timer = setTimeout(done, ms);
  return {
    ended,
    stop() {
      clearTimeout(timer);
      done();
    },
    volume() {},
  };
}

export interface AudioBackend {
  track(id: TrackId): TrackHandle;
  sfx(id: SfxId, gain: number): void;
  /** Preloads the effects (after the unlock, so the first cue is not late). Idempotent. */
  warm(): void;
  resume(): void;
  suspend(): void;
  state(): ContextState;
  /** Plays one line of the dictation's voice once, at `gain` (spec 2026-09-27 §5.1). `ended` resolves
   *  when it ends, is stopped, or cannot be played (a line is never an error of the mixer). */
  line(clip: VoiceClip, gain: number): LineHandle;
}

export interface AudioSnapshot {
  unlocked: boolean;
  settings: AudioSettings;
  wanted: TrackId | null;
  playing: TrackId | null;
  musicGain: number;
  ducks: DuckReason[];
  voiceSpeaking: boolean;
  /** The last effects played (at most 50), oldest first. */
  sfx: SfxId[];
}

export function createEngine(backend: AudioBackend, now: () => number = () => Date.now()) {
  let unlocked = false;
  let gateClosed = false;
  let settings: AudioSettings = DEFAULT_AUDIO;
  let wanted: TrackId | null = null;
  let current: { id: TrackId; handle: TrackHandle } | null = null;
  const ducks = new Set<DuckReason>();
  let line: LineHandle | null = null;
  let release: ReturnType<typeof setTimeout> | null = null;
  const played: SfxId[] = [];
  const lastPlayed = new Map<SfxId, number>();

  const gainFor = (id: TrackId): number => gainOf(settings.music) * TRACKS[id].mix * (ducks.size > 0 ? DUCK_GAIN : 1);

  function sync(fadeMs = FADE_MS): void {
    if (!unlocked) return;
    const target = settings.music.muted ? null : wanted;
    if (current && current.id !== target) {
      // Final review M3: « Musique » off answers at once (the settings' fade); a place change crossfades.
      current.handle.stop(target === null && settings.music.muted ? SETTINGS_FADE_MS : CROSSFADE_MS);
      current = null;
    }
    if (current) {
      current.handle.fadeTo(gainFor(current.id), fadeMs);
    } else if (target) {
      current = { id: target, handle: backend.track(target) };
      current.handle.start(gainFor(target), CROSSFADE_MS);
    }
  }

  /** Drops the voice's pending release (a new line, or the ducks cleared). */
  function holdVoice(): void {
    if (release !== null) clearTimeout(release);
    release = null;
  }

  function duck(reason: DuckReason, on: boolean): void {
    if (ducks.has(reason) === on) return;
    if (on) ducks.add(reason);
    else ducks.delete(reason);
    sync();
  }

  function unlock(): void {
    if (!unlocked) backend.warm();
    backend.resume();
    if (unlocked) return;
    unlocked = true;
    sync();
  }

  /** A tap anywhere: the iPad may have suspended or interrupted the context meanwhile. */
  function poke(): void {
    if (unlocked && backend.state() !== 'running') backend.resume();
  }

  return {
    unlock,
    poke,
    /** A completed gesture anywhere on the page (audio.svelte.ts, gestures.ts). Ruling E3b: after a
     *  reload the first one unlocks, whatever it touched (the dialogue box, a tour, a panel), not
     *  only « Entrer » or a hotspot; every later one resumes a context the iPad suspended or
     *  interrupted (a call, Siri, the lock screen). Behind the closed title gate it does not unlock
     *  (Ruling E3: « Entrer » is the first sound of the game). */
    gesture(): void {
      if (unlocked) poke();
      else if (!gateClosed) unlock();
    },
    /** The title's gate (Title.svelte): closed until « Entrer », whose own tap unlocks. */
    gate(closed: boolean): void {
      gateClosed = closed;
    },
    visibility(hidden: boolean): void {
      if (!unlocked) return;
      if (hidden) backend.suspend();
      else backend.resume();
    },
    setSettings(next: AudioSettings): void {
      settings = next;
      line?.volume(gainOf(settings.voice));
      sync(SETTINGS_FADE_MS);
    },
    /** The battle asks for its loop (the ducks stay: its phases own them). */
    music(id: TrackId | null): void {
      if (id === wanted) return;
      wanted = id;
      sync();
    },
    /** A place takes over (SceneStage): its loop, and no leftover duck from a battle or a speech. */
    scene(id: TrackId | null): void {
      const hadDucks = ducks.size > 0;
      holdVoice();
      ducks.clear();
      if (id !== wanted) {
        wanted = id;
        sync();
      } else if (hadDucks) {
        sync();
      }
    },
    duck,
    /** One line of the dictation's voice (spec 2026-09-27 §5.1): at the voice channel's gain, the music
     *  ducked and effects held while it plays; a new line stops the last. The duck outlasts a line that
     *  ends by VOICE_RELEASE_MS, unless the next line comes (Ruling R-A2); a line stopped (a pause, a
     *  finish, « Quitter ») lets the music up at once. Before the unlock it is silent and takes its
     *  length (Ruling K14). */
    say(clip: VoiceClip): LineHandle {
      line?.stop();
      if (!unlocked) return silentLine(clip.ms);
      holdVoice();
      const h = backend.line(clip, gainOf(settings.voice));
      let stopped = false;
      const handle: LineHandle = {
        ended: h.ended,
        stop() {
          stopped = true;
          h.stop();
        },
        volume: (gain) => h.volume(gain),
      };
      line = handle;
      duck('voice', true);
      void h.ended.then(() => {
        // A stopped line ending late must not let the music up under the next one.
        if (line !== handle) return;
        line = null;
        if (stopped) {
          duck('voice', false);
        } else {
          release = setTimeout(() => {
            release = null;
            duck('voice', false);
          }, VOICE_RELEASE_MS);
        }
      });
      return handle;
    },
    sfx(id: SfxId): void {
      if (!unlocked || settings.sfx.muted || ducks.has('voice')) return;
      const t = now();
      const last = lastPlayed.get(id);
      if (last !== undefined && t - last < SFX_REPEAT_MS) return;
      lastPlayed.set(id, t);
      backend.sfx(id, gainOf(settings.sfx) * SFX[id].mix);
      played.push(id);
      if (played.length > 50) played.shift();
    },
    snapshot(): AudioSnapshot {
      return {
        unlocked,
        settings: JSON.parse(JSON.stringify(settings)) as AudioSettings,
        wanted,
        playing: current?.id ?? null,
        musicGain: current ? gainFor(current.id) : 0,
        ducks: [...ducks].sort(),
        voiceSpeaking: ducks.has('voice'),
        sfx: [...played],
      };
    },
  };
}

export type AudioEngine = ReturnType<typeof createEngine>;
