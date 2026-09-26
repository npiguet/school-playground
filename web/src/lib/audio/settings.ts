// The three channels (scenes UI spec §7, Ruling E2): music, effects and the dictation's voice, each
// with a volume and a mute, saved per hero in `settings.audio`. Pure: store.svelte.ts persists them.
import type { ProfileSettings } from '../types';

export type ChannelId = 'music' | 'sfx' | 'voice';
export interface ChannelSetting {
  volume: number;
  muted: boolean;
}
export type AudioSettings = Record<ChannelId, ChannelSetting>;

export const CHANNELS: ChannelId[] = ['music', 'sfx', 'voice'];

export const DEFAULT_AUDIO: AudioSettings = {
  music: { volume: 0.5, muted: false },
  sfx: { volume: 0.7, muted: false },
  voice: { volume: 1, muted: false },
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** 0-1, two decimals (the sliders step by 0.05). */
export function clampVolume(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
}

/** A hero's channels (`settings` given): the saved ones, repaired, else the old single mute mapped
 *  onto the music and the effects, else the defaults. Before a hero is chosen (`settings` null):
 *  what this device used last, else the defaults. */
export function audioFrom(settings: ProfileSettings | null, device: unknown): AudioSettings {
  const saved: unknown = settings ? settings.audio : device;
  const out = {} as AudioSettings;
  for (const ch of CHANNELS) {
    const s = isRecord(saved) && isRecord(saved[ch]) ? saved[ch] : {};
    out[ch] = {
      volume: clampVolume(s.volume, DEFAULT_AUDIO[ch].volume),
      muted: typeof s.muted === 'boolean' ? s.muted : DEFAULT_AUDIO[ch].muted,
    };
  }
  if (settings && !isRecord(settings.audio) && settings.mute === true) {
    out.music.muted = true;
    out.sfx.muted = true;
  }
  return out;
}

export function gainOf(c: ChannelSetting): number {
  return c.muted ? 0 : c.volume;
}
