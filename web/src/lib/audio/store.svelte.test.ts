import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, body: { settings: object }) => patch(id, body) } } }));

import { profileStore } from '../profileStore.svelte';
import { DEFAULT_AUDIO } from './settings';
import {
  audioSettings,
  bothMuted,
  flushAudioSave,
  flushPendingAudioSave,
  initAudioSettings,
  resetAudioStoreForTests,
  setChannel,
  setChannels,
} from './store.svelte';

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

  // Final review M1: the values of the change, never a later snapshot; and never lost to a reload.
  it("saves a resting slider's own values for its own hero, even after another hero's seeding", async () => {
    initAudioSettings(hero());
    setChannel(4, 'voice', { volume: 0.3 }, { live: true });
    const other = { ...(hero({ audio: { music: { volume: 0.9, muted: true } } }) as object), id: 5 } as never;
    initAudioSettings(other);
    await vi.runAllTimersAsync();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.lastCall![0]).toBe(4);
    expect(patch.mock.lastCall![1]).toMatchObject({ settings: { audio: { voice: { volume: 0.3 }, music: { volume: 0.5, muted: false } } } });
    expect(audioSettings.music).toEqual({ volume: 0.9, muted: true });
  });

  it('sends a waiting slider save at once when asked (the page hides or unloads)', async () => {
    initAudioSettings(hero());
    setChannel(4, 'music', { volume: 0.2 }, { live: true });
    expect(patch).not.toHaveBeenCalled();
    flushPendingAudioSave();
    await flushAudioSave();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.lastCall![1]).toMatchObject({ settings: { audio: { music: { volume: 0.2 } } } });
    await vi.runAllTimersAsync();
    expect(patch).toHaveBeenCalledTimes(1);
  });

  // Final review M2: a whole-profile response that crossed a pending audio save carries the older
  // audio; the next place's seeding must not undo the player's change.
  it('seeds a hero once per page load: a stale profile never reverts the channels', () => {
    initAudioSettings(hero());
    setChannel(4, 'music', { muted: true });
    initAudioSettings(hero({ audio: { music: { volume: 0.5, muted: false } } }));
    expect(audioSettings.music.muted).toBe(true);
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

  // Task 1 review carry: a dragged slider writes the device copy once it rests, not on every step.
  it('writes the device copy when a slider comes to rest or is released, and at once for a toggle', async () => {
    const s = storage([]);
    const writes: string[] = [];
    const setItem = s.setItem;
    s.setItem = (k: string, v: string) => {
      const a = JSON.parse(v) as typeof DEFAULT_AUDIO;
      if (k === 'discorde.audio') writes.push(`${a.voice.volume}${a.music.muted ? ' music off' : ''}`);
      setItem(k, v);
    };
    const store = await loadWith(s);
    store.setChannel(4, 'voice', { volume: 0.9 }, { live: true });
    store.setChannel(4, 'voice', { volume: 0.8 }, { live: true });
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(400);
    expect(writes).toEqual(['0.8']);
    store.setChannel(4, 'voice', { volume: 0.7 }, { live: true });
    store.setChannel(4, 'voice', { volume: 0.6 });
    store.setChannel(4, 'music', { muted: true });
    await vi.runAllTimersAsync();
    expect(writes).toEqual(['0.8', '0.6', '0.6 music off']);
  });

  it("seeds nothing muted from an old '0'", async () => {
    const s = storage([['discorde.mute', '0']]);
    const { audioSettings: a } = await loadWith(s);
    expect([a.music.muted, a.sfx.muted]).toEqual([false, false]);
    expect(s.m.has('discorde.mute')).toBe(false);
  });
});
