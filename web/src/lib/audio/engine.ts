// The mixer (scenes UI spec §7, Rulings E3-E6): one loop at a time on the music channel, short
// effects on the sfx channel, and the voice (speechSynthesis, played elsewhere) only signalled here,
// so the music ducks under it and no effect talks over it. Backend-agnostic: Howler in the browser
// (howlerBackend.ts), a recorder in vitest and in every e2e run (recordingBackend.ts). Nothing plays
// before `unlock()`, which a tap calls (iOS only lets a gesture start audio); a loop asked for
// earlier waits for it.
import { SFX, TRACKS, type SfxId, type TrackId } from './catalog';
import { DEFAULT_AUDIO, gainOf, type AudioSettings } from './settings';

export type DuckReason = 'voice' | 'dictation' | 'proofreading';
export type ContextState = 'running' | 'suspended' | 'interrupted' | 'closed' | 'none';

export const DUCK_GAIN = 0.3;
export const FADE_MS = 400;
export const CROSSFADE_MS = 1200;
export const SETTINGS_FADE_MS = 150;
export const SFX_REPEAT_MS = 80;

export interface TrackHandle {
  /** Starts the loop silent and fades it up to `gain` (at once if it is still loading: when ready). */
  start(gain: number, fadeMs: number): void;
  fadeTo(gain: number, fadeMs: number): void;
  /** Fades out, then stops and frees the loop (a loop still loading never starts). */
  stop(fadeMs: number): void;
}

export interface AudioBackend {
  track(id: TrackId): TrackHandle;
  sfx(id: SfxId, gain: number): void;
  /** Preloads the effects (after the unlock, so the first cue is not late). Idempotent. */
  warm(): void;
  resume(): void;
  suspend(): void;
  state(): ContextState;
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
  let settings: AudioSettings = DEFAULT_AUDIO;
  let wanted: TrackId | null = null;
  let current: { id: TrackId; handle: TrackHandle } | null = null;
  const ducks = new Set<DuckReason>();
  const played: SfxId[] = [];
  const lastPlayed = new Map<SfxId, number>();

  const gainFor = (id: TrackId): number => gainOf(settings.music) * TRACKS[id].mix * (ducks.size > 0 ? DUCK_GAIN : 1);

  function sync(fadeMs = FADE_MS): void {
    if (!unlocked) return;
    const target = settings.music.muted ? null : wanted;
    if (current && current.id !== target) {
      current.handle.stop(CROSSFADE_MS);
      current = null;
    }
    if (current) {
      current.handle.fadeTo(gainFor(current.id), fadeMs);
    } else if (target) {
      current = { id: target, handle: backend.track(target) };
      current.handle.start(gainFor(target), CROSSFADE_MS);
    }
  }

  function duck(reason: DuckReason, on: boolean): void {
    if (ducks.has(reason) === on) return;
    if (on) ducks.add(reason);
    else ducks.delete(reason);
    sync();
  }

  return {
    unlock(): void {
      if (!unlocked) backend.warm();
      backend.resume();
      if (unlocked) return;
      unlocked = true;
      sync();
    },
    /** A tap anywhere: the iPad may have suspended or interrupted the context meanwhile. */
    poke(): void {
      if (unlocked && backend.state() !== 'running') backend.resume();
    },
    visibility(hidden: boolean): void {
      if (!unlocked) return;
      if (hidden) backend.suspend();
      else backend.resume();
    },
    setSettings(next: AudioSettings): void {
      settings = next;
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
      ducks.clear();
      if (id !== wanted) {
        wanted = id;
        sync();
      } else if (hadDucks) {
        sync();
      }
    },
    duck,
    voice(speaking: boolean): void {
      duck('voice', speaking);
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
