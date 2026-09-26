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
const LIVE_SAVE_MS = 400;

function readDevice(): unknown {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
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

export function initAudioSettings(profile: Profile): void {
  assign(audioFrom(profile.settings, null));
}

export const bothMuted = (): boolean => audioSettings.music.muted && audioSettings.sfx.muted;

let chain: Promise<unknown> = Promise.resolve();
let liveTimer: ReturnType<typeof setTimeout> | undefined;

function save(profileId: number): void {
  clearTimeout(liveTimer);
  liveTimer = undefined;
  const audio = snapshotAudio();
  chain = chain
    .then(() => api.profiles.patch(profileId, { settings: { audio } }))
    .catch(() => {
      // Server out of reach: the local values still apply; the next load reconciles.
    });
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
  // UI3 final review I3: a screen that re-seeds from the in-session hero must see the change.
  const current = profileStore.current;
  if (current && current.id === profileId) current.settings = { ...current.settings, audio: s };
  writeDevice(s);
  if (opts.live) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => save(profileId), LIVE_SAVE_MS);
  } else {
    save(profileId);
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
  chain = Promise.resolve();
  assign(DEFAULT_AUDIO);
}
