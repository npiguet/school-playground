import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({ api: { profiles: { patch: vi.fn(async () => ({})) } } }));

// A page as installAudio sees it, in node: the e2e stub flag (so the recording backend), a window
// that events can be dispatched on, and an inert document.
const on = () => undefined;
const page = Object.assign(new EventTarget(), { __discordeAudioStub: true });
vi.stubGlobal('window', page);
vi.stubGlobal('document', { hidden: false, addEventListener: on, removeEventListener: on });

const { audio, installAudio, withAudio } = await import('./audio.svelte');
type AudioProbe = import('./audio.svelte').AudioProbe;
const { setChannel } = await import('./store.svelte');
const { playSfx, unlockAudio } = await import('../juice/sfx');

let teardown = () => undefined as void;
beforeEach(() => {
  teardown = installAudio();
});
afterEach(() => teardown());

describe('the mixer on the page (lane A review)', () => {
  it('hears a channel change inside the same tap: the effect confirming the effects comes back plays (#5)', async () => {
    unlockAudio();
    setChannel(4, 'sfx', { muted: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(audio().snapshot().settings.sfx.muted).toBe(true);
    // The sound plate's flip: unmute, then the confirming tap, in one handler.
    setChannel(4, 'sfx', { muted: false });
    playSfx('tap');
    expect(audio().snapshot().sfx.at(-1)).toBe('tap');
    expect(audio().snapshot().settings.sfx.muted).toBe(false);
  });

  it('never lets a mixer failure out of a component, an effect or a listener (#9)', () => {
    const scene = vi.spyOn(audio(), 'scene').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => withAudio((e) => e.scene('camp'))).not.toThrow();
    const sfx = vi.spyOn(audio(), 'sfx').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => playSfx('tap')).not.toThrow();
    scene.mockRestore();
    sfx.mockRestore();
  });

  it('publishes its state for the e2e pages and never loads Howler there (#12)', () => {
    const w = window as unknown as { __discordeAudio?: AudioProbe };
    expect(w.__discordeAudio).toBeDefined();
    expect(typeof w.__discordeAudio!.lines).toBe('function');
    expect(w.__discordeAudio!.lines()).toEqual([]);
  });

  // Ruling E3b and final review I3: a completed gesture anywhere unlocks, then resumes an
  // interrupted context; a finger's pointerdown does neither.
  it('hears every completed gesture on the page, never a pointerdown', () => {
    const gesture = vi.spyOn(audio(), 'gesture');
    page.dispatchEvent(new Event('pointerdown'));
    expect(gesture).not.toHaveBeenCalled();
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) page.dispatchEvent(new Event(type));
    expect(gesture).toHaveBeenCalledTimes(4);
    gesture.mockRestore();
    teardown();
    teardown = () => undefined;
    const after = vi.spyOn(audio(), 'gesture');
    page.dispatchEvent(new Event('click'));
    expect(after).not.toHaveBeenCalled();
    after.mockRestore();
  });

  it('resumes an interrupted context on the next tap anywhere (a call, Siri, the lock screen)', () => {
    const probe = (window as unknown as { __discordeAudio: AudioProbe }).__discordeAudio;
    page.dispatchEvent(new Event('click'));
    expect(audio().snapshot().unlocked).toBe(true);
    expect(probe.context()).toBe('running');
    probe.interrupt();
    expect(probe.context()).toBe('interrupted');
    page.dispatchEvent(new Event('pointerdown'));
    expect(probe.context()).toBe('interrupted');
    page.dispatchEvent(new Event('pointerup'));
    expect(probe.context()).toBe('running');
  });
});
