// The hero's channels ($state, Ruling E2): server-authoritative in `settings.audio`, mirrored on the
// device so the title (no hero yet) starts from the last values. A toggle saves at once; a moving
// slider saves once it rests and at once on release. Saves are chained, so the server sees them in
// the order they were made (two quick toggles never land reversed). Sound is a convenience: no
// failure here ever reaches the player.
import { api } from '../api';
import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import { CHANNELS, DEFAULT_AUDIO, audioFrom, clampVolume, type AudioSettings, type ChannelId, type ChannelSetting } from './settings';

const DEVICE_KEY = 'discorde.audio';
/** Before UI5 the device kept one switch for the music and the effects ('1' muted). */
const LEGACY_MUTE_KEY = 'discorde.mute';
const LIVE_SAVE_MS = 400;

/** The device mirror. An old `discorde.mute` is read once: it seeds the music and the effects of a
 *  new mirror (never one already there, which is newer), then is removed. */
function readDevice(): unknown {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    const legacy = localStorage.getItem(LEGACY_MUTE_KEY);
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_MUTE_KEY);
      if (!raw) {
        const muted = legacy === '1';
        const seeded: AudioSettings = { ...DEFAULT_AUDIO, music: { ...DEFAULT_AUDIO.music, muted }, sfx: { ...DEFAULT_AUDIO.sfx, muted } };
        writeDevice(seeded);
        return seeded;
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDevice(s: AudioSettings): void {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable (private mode, quota): the hero's settings still apply.
  }
}

export const audioSettings = $state<AudioSettings>(audioFrom(null, readDevice()));

function assign(s: AudioSettings): void {
  for (const ch of CHANNELS) audioSettings[ch] = { ...s[ch] };
}

/** A plain copy (never the $state proxy): what the engine and the server receive. */
export function snapshotAudio(): AudioSettings {
  return {
    music: { ...audioSettings.music },
    sfx: { ...audioSettings.sfx },
    voice: { ...audioSettings.voice },
  };
}

/** The hero whose channels the store holds (seeded once a page load: final review M2). */
let seededFor: number | null = null;

/** Seeds the channels from the hero, once per hero and page load. Later on the store is the truth:
 *  a whole-profile response that crossed a pending audio save (a PATCH of the tours, the lyre's
 *  « Enregistrer ») carries the older `settings.audio`, and re-seeding from it at the next place
 *  would silently undo the player's last change (final review M2). */
export function initAudioSettings(profile: Profile): void {
  if (seededFor === profile.id) return;
  flushPendingAudioSave();
  seededFor = profile.id;
  assign(audioFrom(profile.settings, null));
}

export const bothMuted = (): boolean => audioSettings.music.muted && audioSettings.sfx.muted;

let chain: Promise<unknown> = Promise.resolve();
let liveTimer: ReturnType<typeof setTimeout> | undefined;
/** A moving slider's save, waiting for the slider to rest: its hero and the values of the change
 *  (final review M1: never a later snapshot, which could be another hero's). */
let pending: { profileId: number; audio: AudioSettings } | null = null;
let sink: ((s: AudioSettings) => void) | null = null;

/** The mixer's ear (installAudio): told synchronously of every channel change made here. */
export function setAudioSink(fn: ((s: AudioSettings) => void) | null): void {
  sink = fn;
}

function send(profileId: number, audio: AudioSettings): void {
  writeDevice(audio);
  chain = chain
    .then(() => api.profiles.patch(profileId, { settings: { audio } }))
    .catch(() => {
      // Server out of reach: the local values still apply; the next load reconciles.
    });
}

/** The device copy and the server's, together: a toggle at once, a slider once it rests. A waiting
 *  slider save of another hero goes first, with its own values. */
function save(profileId: number, audio: AudioSettings): void {
  const waiting = pending;
  clearTimeout(liveTimer);
  liveTimer = undefined;
  pending = null;
  if (waiting && waiting.profileId !== profileId) send(waiting.profileId, waiting.audio);
  send(profileId, audio);
}

/** Final review M1: a slider's save still waiting to rest goes now (installAudio calls this when the
 *  page hides or unloads, so a reload right after a slider move keeps it). */
export function flushPendingAudioSave(): void {
  if (pending) save(pending.profileId, pending.audio);
}

export function setChannels(
  profileId: number,
  patch: Partial<Record<ChannelId, Partial<ChannelSetting>>>,
  opts: { live?: boolean } = {},
): void {
  for (const ch of CHANNELS) {
    const p = patch[ch];
    if (!p) continue;
    const cur = audioSettings[ch];
    audioSettings[ch] = {
      volume: p.volume === undefined ? cur.volume : clampVolume(p.volume, cur.volume),
      muted: p.muted ?? cur.muted,
    };
  }
  const s = snapshotAudio();
  // Lane A review #5: the mixer hears the change inside the same tap (an effect confirming the
  // effects' return plays), not a microtask later through installAudio's $effect.
  sink?.(s);
  // UI3 final review I3: a screen that re-seeds from the in-session hero must see the change.
  const current = profileStore.current;
  if (current && current.id === profileId) current.settings = { ...current.settings, audio: s };
  if (opts.live) {
    if (pending && pending.profileId !== profileId) flushPendingAudioSave();
    clearTimeout(liveTimer);
    pending = { profileId, audio: s };
    liveTimer = setTimeout(flushPendingAudioSave, LIVE_SAVE_MS);
  } else {
    save(profileId, s);
  }
}

export function setChannel(profileId: number, ch: ChannelId, patch: Partial<ChannelSetting>, opts: { live?: boolean } = {}): void {
  setChannels(profileId, { [ch]: patch }, opts);
}

/** Tests: waits for every save made so far. */
export async function flushAudioSave(): Promise<void> {
  await chain;
}

export function resetAudioStoreForTests(): void {
  clearTimeout(liveTimer);
  liveTimer = undefined;
  pending = null;
  seededFor = null;
  chain = Promise.resolve();
  assign(DEFAULT_AUDIO);
}
