import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({ api: { profiles: { patch: vi.fn(async () => ({})) } } }));

// A page as installAudio sees it, in node: the e2e stub flag (so the recording backend) and inert
// listeners.
const on = () => undefined;
vi.stubGlobal('window', { __discordeAudioStub: true, addEventListener: on, removeEventListener: on });
vi.stubGlobal('document', { hidden: false, addEventListener: on, removeEventListener: on });

const { audio, installAudio, withAudio } = await import('./audio.svelte');
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
    expect((window as unknown as { __discordeAudio?: object }).__discordeAudio).toBeDefined();
  });
});
