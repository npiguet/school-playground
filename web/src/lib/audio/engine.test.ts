import { describe, expect, it } from 'vitest';
import { CROSSFADE_MS, DUCK_GAIN, FADE_MS, SETTINGS_FADE_MS, SFX_REPEAT_MS, createEngine } from './engine';
import { recordingBackend } from './recordingBackend';
import { DEFAULT_AUDIO, type AudioSettings } from './settings';

const with_ = (patch: Partial<Record<keyof AudioSettings, Partial<AudioSettings['music']>>>): AudioSettings => {
  const s = JSON.parse(JSON.stringify(DEFAULT_AUDIO)) as AudioSettings;
  for (const [k, v] of Object.entries(patch)) Object.assign(s[k as keyof AudioSettings], v);
  return s;
};

function setup() {
  const backend = recordingBackend();
  let t = 1000;
  const engine = createEngine(backend, () => t);
  return { backend, engine, later: (ms: number) => (t += ms) };
}
const live = (b: ReturnType<typeof recordingBackend>) => b.log.tracks.filter((x) => !x.stopped).map((x) => x.id);

describe('the mixer (spec §7)', () => {
  it('plays nothing before the unlock gesture, then the loop the place asked for (Ruling E3)', () => {
    const { backend, engine } = setup();
    engine.scene('camp');
    engine.sfx('tap');
    expect(backend.log.tracks).toEqual([]);
    expect(backend.log.sfx).toEqual([]);
    expect(engine.snapshot()).toMatchObject({ unlocked: false, wanted: 'camp', playing: null });
    engine.unlock();
    expect(backend.log.state).toBe('running');
    expect(backend.log.calls).toContain(`start camp 0.5 ${CROSSFADE_MS}`);
    expect(engine.snapshot()).toMatchObject({ unlocked: true, playing: 'camp' });
    engine.unlock();
    expect(live(backend)).toEqual(['camp']);
  });

  it('crossfades to the next loop, one loop at a time (Ruling E4)', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.scene('camp');
    engine.scene('temple');
    expect(backend.log.calls.slice(-2)).toEqual([`stop camp ${CROSSFADE_MS}`, `start temple 0.5 ${CROSSFADE_MS}`]);
    expect(live(backend)).toEqual(['temple']);
    engine.scene('temple');
    expect(backend.log.tracks).toHaveLength(2);
  });

  it('stops the music when muted and brings it back when unmuted', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.scene('sea');
    engine.setSettings(with_({ music: { muted: true } }));
    expect(live(backend)).toEqual([]);
    expect(engine.snapshot().playing).toBeNull();
    // Final review M3: the mute answers at the settings' fade, not the places' 1.2 s crossfade.
    expect(backend.log.calls.at(-1)).toBe(`stop sea ${SETTINGS_FADE_MS}`);
    engine.setSettings(with_({ music: { muted: false, volume: 0.8 } }));
    expect(live(backend)).toEqual(['sea']);
    expect(backend.log.tracks.at(-1)!.gain).toBeCloseTo(0.8);
  });

  it('ducks under the voice, the dictation and the proofreading, until every reason is gone (Ruling E5)', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.music('battle');
    const full = 0.5 * 0.9;
    engine.duck('dictation', true);
    expect(backend.log.calls.at(-1)).toBe(`fade battle ${full * DUCK_GAIN} ${FADE_MS}`);
    engine.voice(true);
    engine.duck('dictation', false);
    expect(engine.snapshot()).toMatchObject({ ducks: ['voice'], voiceSpeaking: true });
    expect(backend.log.tracks[0].gain).toBeCloseTo(full * DUCK_GAIN);
    engine.voice(false);
    expect(backend.log.tracks[0].gain).toBeCloseTo(full);
    engine.duck('proofreading', true);
    engine.duck('proofreading', true);
    // dictation on, voice on, dictation off, voice off, proofreading on; the second « on » is a no-op.
    expect(backend.log.calls.filter((c) => c.startsWith('fade')).length).toBe(5);
  });

  it('clears the battle\'s ducks and the voice when a place takes over', () => {
    const { backend, engine } = setup();
    engine.unlock();
    engine.music('battle');
    engine.duck('proofreading', true);
    engine.voice(true);
    engine.scene('camp');
    expect(engine.snapshot()).toMatchObject({ ducks: [], voiceSpeaking: false, playing: 'camp' });
    expect(backend.log.tracks.at(-1)!.gain).toBeCloseTo(0.5);
  });

  it('plays effects at their volume, never muted, never over the voice, never twice in 80 ms (Ruling E6)', () => {
    const { backend, engine, later } = setup();
    engine.unlock();
    engine.sfx('chime');
    expect(backend.log.sfx.at(-1)).toEqual({ id: 'chime', gain: 0.7 });
    engine.sfx('chime');
    later(SFX_REPEAT_MS);
    engine.sfx('chime');
    expect(backend.log.sfx.filter((s) => s.id === 'chime')).toHaveLength(2);
    engine.voice(true);
    engine.sfx('tap');
    engine.voice(false);
    engine.setSettings(with_({ sfx: { muted: true } }));
    engine.sfx('seal');
    expect(backend.log.sfx.map((s) => s.id)).toEqual(['chime', 'chime']);
    expect(engine.snapshot().sfx).toEqual(['chime', 'chime']);
    engine.setSettings(with_({ sfx: { volume: 0.5 } }));
    engine.sfx('tap');
    expect(backend.log.sfx.at(-1)).toEqual({ id: 'tap', gain: 0.5 * 0.6 });
  });

  it('suspends when the page hides and resumes when it shows or on the next tap (iPad)', () => {
    const { backend, engine } = setup();
    engine.visibility(true);
    engine.poke();
    expect(backend.log.calls).toEqual([]);
    engine.unlock();
    engine.visibility(true);
    expect(backend.log.state).toBe('suspended');
    engine.visibility(false);
    expect(backend.log.state).toBe('running');
    backend.log.state = 'interrupted';
    engine.poke();
    expect(backend.log.state).toBe('running');
  });

  // Ruling E3b: after a reload the first gesture anywhere unlocks (not only « Entrer » or a hotspot);
  // every later one resumes a context the iPad interrupted (final review I3).
  it('unlocks on the first gesture anywhere, then resumes an interrupted context on the next', () => {
    const { backend, engine } = setup();
    engine.scene('camp');
    engine.gesture();
    expect(engine.snapshot()).toMatchObject({ unlocked: true, playing: 'camp' });
    expect(backend.log.state).toBe('running');
    const calls = backend.log.calls.length;
    engine.gesture();
    expect(backend.log.calls).toHaveLength(calls);
    backend.log.state = 'interrupted';
    engine.gesture();
    expect(backend.log.state).toBe('running');
    expect(backend.log.tracks.filter((t) => !t.stopped).map((t) => t.id)).toEqual(['camp']);
  });

  it("never unlocks on a gesture behind the title's closed gate: only « Entrer » does (Ruling E3)", () => {
    const { backend, engine } = setup();
    engine.scene('sea');
    engine.gate(true);
    engine.gesture();
    expect(engine.snapshot()).toMatchObject({ unlocked: false, playing: null });
    expect(backend.log.state).toBe('suspended');
    engine.unlock(); // « Entrer »
    engine.gate(false);
    expect(engine.snapshot()).toMatchObject({ unlocked: true, playing: 'sea' });
    backend.log.state = 'interrupted';
    engine.gate(true);
    engine.gesture(); // once unlocked, a tap resumes wherever it lands
    expect(backend.log.state).toBe('running');
  });
});
