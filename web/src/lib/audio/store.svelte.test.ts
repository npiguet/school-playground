import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, body: { settings: object }) => patch(id, body) } } }));

import { profileStore } from '../profileStore.svelte';
import { DEFAULT_AUDIO } from './settings';
import { audioSettings, bothMuted, flushAudioSave, initAudioSettings, resetAudioStoreForTests, setChannel, setChannels } from './store.svelte';

const hero = (settings: object = {}) => ({ id: 4, name: 'Io', avatar: 'chouette', level: '10H', has_pin: false, help_stage: 1, created_at: '', settings }) as never;

beforeEach(() => {
  patch.mockClear();
  resetAudioStoreForTests();
  profileStore.current = hero();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('the channel store (Ruling E2)', () => {
  it("seeds from the hero, the old mute included", () => {
    initAudioSettings(hero({ mute: true }));
    expect(audioSettings.music.muted && audioSettings.sfx.muted && !audioSettings.voice.muted).toBe(true);
    expect(bothMuted()).toBe(true);
  });

  it('saves a toggle at once, as the whole audio object, and keeps the in-session hero in step', async () => {
    initAudioSettings(hero());
    setChannel(4, 'music', { muted: true });
    await vi.runAllTimersAsync();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenLastCalledWith(4, { settings: { audio: { ...DEFAULT_AUDIO, music: { volume: 0.5, muted: true } } } });
    expect((profileStore.current as { settings: { audio: object } }).settings.audio).toEqual({ ...DEFAULT_AUDIO, music: { volume: 0.5, muted: true } });
  });

  it('saves a moving slider once it rests, and at once on release', async () => {
    initAudioSettings(hero());
    setChannel(4, 'voice', { volume: 0.9 }, { live: true });
    setChannel(4, 'voice', { volume: 0.8 }, { live: true });
    await vi.advanceTimersByTimeAsync(399);
    expect(patch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(patch).toHaveBeenCalledTimes(1);
    setChannel(4, 'voice', { volume: 0.7 }, { live: true });
    setChannel(4, 'voice', { volume: 0.6 });
    await vi.runAllTimersAsync();
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.lastCall![1]).toMatchObject({ settings: { audio: { voice: { volume: 0.6, muted: false } } } });
  });

  it('sends the saves in order, one after the other', async () => {
    initAudioSettings(hero());
    const order: string[] = [];
    patch.mockImplementation(async (id, body) => {
      order.push(JSON.stringify((body.settings as { audio: { sfx: { muted: boolean } } }).audio.sfx.muted));
      return { id, settings: body.settings };
    });
    setChannels(4, { music: { muted: true }, sfx: { muted: true } });
    setChannel(4, 'sfx', { muted: false });
    await flushAudioSave();
    expect(order).toEqual(['true', 'false']);
  });

  it('never throws when the server or the storage is out of reach', async () => {
    patch.mockRejectedValueOnce(new Error('offline'));
    initAudioSettings(hero());
    expect(() => setChannel(4, 'sfx', { muted: true })).not.toThrow();
    await flushAudioSave();
    expect(audioSettings.sfx.muted).toBe(true);
  });
});

// Task 1 carry: before UI5 the device kept one switch, `discorde.mute` ('1' muted). The store reads it
// once at load, into the music and the effects of the new mirror, then removes it.
describe('the old device mute', () => {
  function storage(entries: [string, string][]) {
    const m = new Map(entries);
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  }
  async function loadWith(s: ReturnType<typeof storage>) {
    vi.stubGlobal('localStorage', s);
    vi.resetModules();
    return import('./store.svelte');
  }
  afterEach(() => vi.unstubAllGlobals());

  it('seeds the music and the effects of the device mirror, once, then is removed', async () => {
    const s = storage([['discorde.mute', '1']]);
    const { audioSettings: a } = await loadWith(s);
    expect([a.music.muted, a.sfx.muted, a.voice.muted]).toEqual([true, true, false]);
    expect(s.m.has('discorde.mute')).toBe(false);
    expect(JSON.parse(s.m.get('discorde.audio')!)).toEqual({ ...DEFAULT_AUDIO, music: { volume: 0.5, muted: true }, sfx: { volume: 0.7, muted: true } });
    const again = await loadWith(s);
    expect(again.audioSettings.music.muted).toBe(true);
  });

  it('never overrides the newer mirror, and goes all the same', async () => {
    const s = storage([['discorde.mute', '1'], ['discorde.audio', JSON.stringify(DEFAULT_AUDIO)]]);
    const { audioSettings: a } = await loadWith(s);
    expect([a.music.muted, a.sfx.muted]).toEqual([false, false]);
    expect(s.m.has('discorde.mute')).toBe(false);
  });

  it("seeds nothing muted from an old '0'", async () => {
    const s = storage([['discorde.mute', '0']]);
    const { audioSettings: a } = await loadWith(s);
    expect([a.music.muted, a.sfx.muted]).toEqual([false, false]);
    expect(s.m.has('discorde.mute')).toBe(false);
  });
});
