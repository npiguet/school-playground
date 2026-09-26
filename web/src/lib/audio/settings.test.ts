import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO, audioFrom, clampVolume, gainOf } from './settings';

describe('the three channels (spec §7, Ruling E2)', () => {
  it('starts from the defaults: music 0.5, effects 0.7, voice 1, nothing muted', () => {
    expect(audioFrom({}, null)).toEqual(DEFAULT_AUDIO);
    expect(DEFAULT_AUDIO).toEqual({
      music: { volume: 0.5, muted: false },
      sfx: { volume: 0.7, muted: false },
      voice: { volume: 1, muted: false },
    });
  });

  it("reads the hero's saved channels, repairing whatever is missing or out of range", () => {
    const s = audioFrom({ audio: { music: { volume: 0.2, muted: true }, sfx: { volume: 7, muted: 'x' }, voice: {} } as never }, null);
    expect(s).toEqual({ music: { volume: 0.2, muted: true }, sfx: { volume: 1, muted: false }, voice: { volume: 1, muted: false } });
  });

  it('maps the old single mute onto the music and the effects, never the voice', () => {
    expect(audioFrom({ mute: true }, null)).toEqual({ ...DEFAULT_AUDIO, music: { volume: 0.5, muted: true }, sfx: { volume: 0.7, muted: true } });
    expect(audioFrom({ mute: true, audio: DEFAULT_AUDIO }, null)).toEqual(DEFAULT_AUDIO);
  });

  it("uses the device's last channels only before a hero is chosen", () => {
    const device = { music: { volume: 0.1, muted: false }, sfx: { volume: 0.3, muted: true }, voice: { volume: 0.9, muted: false } };
    expect(audioFrom(null, device)).toEqual(device);
    expect(audioFrom({}, device)).toEqual(DEFAULT_AUDIO);
    expect(audioFrom(null, 'garbage')).toEqual(DEFAULT_AUDIO);
  });

  it('clamps and rounds a volume, and silences a muted channel', () => {
    expect(clampVolume(0.333, 1)).toBe(0.33);
    expect(clampVolume(-1, 1)).toBe(0);
    expect(clampVolume(Number.NaN, 0.4)).toBe(0.4);
    expect(gainOf({ volume: 0.6, muted: false })).toBe(0.6);
    expect(gainOf({ volume: 0.6, muted: true })).toBe(0);
  });
});
