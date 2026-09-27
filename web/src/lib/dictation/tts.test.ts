import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cancelSpeech, listFrenchVoices, pickVoice, SPEECH_MS_PER_CHAR, speak, ttsAvailable, unlockSpeech, waitForVoices } from './tts';
import { buildPlan, buildScript, PACE_RATES } from './script';
import { createRunner } from './runner';

const v = (name: string, lang: string) => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

describe('listFrenchVoices', () => {
  it('keeps only French voices, best first', () => {
    const voices = [v('Zoe', 'fr-FR'), v('Alex', 'en-US'), v('Thomas', 'fr-FR'), v('Amélie (Enhanced)', 'fr-CA'), v('Léa', 'fr-CH')];
    expect(listFrenchVoices(voices).map((x) => x.name)).toEqual(['Amélie (Enhanced)', 'Léa', 'Thomas', 'Zoe']);
  });
  it('picks the preferred voice by name, else the best French one', () => {
    const voices = [v('Zoe', 'fr-FR'), v('Thomas', 'fr-FR')];
    expect(pickVoice(voices, 'Zoe')?.name).toBe('Zoe');
    expect(pickVoice(voices, 'Nope')?.name).toBe('Thomas');
    expect(pickVoice([], null)).toBeUndefined();
  });
});

describe('speak', () => {
  let spoken: { text: string; rate: number }[];
  beforeEach(() => {
    spoken = [];
    class FakeUtterance { text: string; rate = 1; lang = ''; voice: unknown = null; pitch = 1; onend: null | (() => void) = null; onerror: null | (() => void) = null; constructor(t: string) { this.text = t; } }
    (globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
    (globalThis as any).speechSynthesis = {
      speak: (u: any) => { spoken.push({ text: u.text, rate: u.rate }); setTimeout(() => u.onend?.(), 5); },
      cancel: vi.fn(), getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {},
    };
  });
  afterEach(() => { delete (globalThis as any).speechSynthesis; delete (globalThis as any).SpeechSynthesisUtterance; });
  it('resolves when the utterance ends and cancels the queue first', async () => {
    expect(ttsAvailable()).toBe(true);
    await speak('Bonjour, virgule.', { rate: 0.85 });
    expect(spoken).toEqual([{ text: 'Bonjour, virgule.', rate: 0.85 }]);
    expect((globalThis as any).speechSynthesis.cancel).toHaveBeenCalled();
  });
  it('resolves after a delay when TTS is unavailable', async () => {
    delete (globalThis as any).speechSynthesis;
    expect(ttsAvailable()).toBe(false);
    const t0 = Date.now();
    await speak('abc', { rate: 1 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250);
  });
  it('unlockSpeech speaks an empty utterance synchronously and is a no-op without TTS', () => {
    unlockSpeech();
    expect(spoken).toEqual([{ text: '', rate: 1 }]);
    delete (globalThis as any).speechSynthesis;
    expect(() => unlockSpeech()).not.toThrow();
  });
  it('defers the next speak() by a short tick when something was speaking or pending (iOS cancel bug)', async () => {
    (globalThis as any).speechSynthesis.speaking = true;
    const promise = speak('Après.', { rate: 1 });
    // Not spoken synchronously nor on the same tick as cancel() — gives iOS
    // a moment to actually apply the cancel before the next speak().
    expect(spoken).toEqual([]);
    await promise;
    expect(spoken).toEqual([{ text: 'Après.', rate: 1 }]);
  });
});

describe('waitForVoices', () => {
  afterEach(() => {
    delete (globalThis as any).speechSynthesis;
  });

  it('resolves via the voiceschanged event when voices load asynchronously', async () => {
    const handlers: { onVoicesChanged: (() => void) | null } = { onVoicesChanged: null };
    let voices: SpeechSynthesisVoice[] = [];
    (globalThis as any).speechSynthesis = {
      getVoices: () => voices,
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'voiceschanged') handlers.onVoicesChanged = handler;
      },
      removeEventListener: () => {},
    };
    const promise = waitForVoices(1000);
    voices = [v('Zoe', 'fr-FR')];
    handlers.onVoicesChanged?.();
    const result = await promise;
    expect(result.map((x) => x.name)).toEqual(['Zoe']);
  });

  it('resolves with whatever getVoices() returns once the timeout elapses', async () => {
    (globalThis as any).speechSynthesis = {
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const t0 = Date.now();
    const result = await waitForVoices(30);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25);
    expect(result).toEqual([]);
  });
});

describe('cancelSpeech', () => {
  it('calls speechSynthesis.cancel() when available and is a no-op otherwise', () => {
    const cancel = vi.fn();
    (globalThis as any).speechSynthesis = { cancel };
    cancelSpeech();
    expect(cancel).toHaveBeenCalled();
    delete (globalThis as any).speechSynthesis;
    expect(() => cancelSpeech()).not.toThrow();
  });
});

describe('the voice channel (Rulings E5, E7)', () => {
  beforeEach(() => {
    class FakeUtterance { text: string; rate = 1; volume = 1; lang = ''; voice: unknown = null; pitch = 1; onend: null | (() => void) = null; onerror: null | (() => void) = null; constructor(t: string) { this.text = t; } }
    (globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
    (globalThis as any).speechSynthesis = { speak: () => undefined, cancel: vi.fn(), getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {} };
  });
  afterEach(async () => {
    vi.useRealTimers();
    const { audioSettings } = await import('../audio/store.svelte');
    audioSettings.voice = { volume: 1, muted: false };
    delete (globalThis as any).speechSynthesis;
    delete (globalThis as any).SpeechSynthesisUtterance;
  });

  it('speaks at the voice channel\'s gain and ducks the music while it speaks', async () => {
    const { audioSettings } = await import('../audio/store.svelte');
    const { audio } = await import('../audio/audio.svelte');
    audioSettings.voice = { volume: 0.4, muted: false };
    const volumes: number[] = [];
    (globalThis as any).speechSynthesis.speak = (u: any) => {
      volumes.push(u.volume);
      expect(audio().snapshot().voiceSpeaking).toBe(true);
      setTimeout(() => u.onend?.(), 5);
    };
    await speak('Un.', { rate: 1 });
    expect(volumes).toEqual([0.4]);
    expect(audio().snapshot().voiceSpeaking).toBe(false);
  });

  // Ruling E7b (lane A review #2): iOS ignores an utterance's volume, so a muted voice is never
  // handed to speechSynthesis; the line takes its time all the same, and the dictation keeps its pace.
  it('says nothing when the voice is muted, and still takes the line\'s time', async () => {
    vi.useFakeTimers();
    const { audioSettings } = await import('../audio/store.svelte');
    const { audio } = await import('../audio/audio.svelte');
    audioSettings.voice = { volume: 0.4, muted: true };
    const said: string[] = [];
    (globalThis as any).speechSynthesis.speak = (u: any) => void said.push(u.text);
    let done = false;
    // Final review I1: the time the voice would take, at the line's rate (10 characters at 0.75).
    void speak('Deux mots.', { rate: 0.75 }).then(() => (done = true));
    expect(audio().snapshot().voiceSpeaking).toBe(false);
    const ms = (10 * SPEECH_MS_PER_CHAR) / 0.75;
    await vi.advanceTimersByTimeAsync(ms - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(said).toEqual([]);
  });

  // Final review I1: the calibration lines (tts.ts, SPEECH_MS_PER_CHAR), each spoken by a voice that
  // takes what the e2e WebKit's took (ms a character at rate 1, divided by the rate), and muted: the
  // same line takes the same time within 20 %, at every pace's rate.
  it('keeps the pace muted: a muted line takes the time the voice takes, within 20 %, at every rate', async () => {
    vi.useFakeTimers();
    const { audioSettings } = await import('../audio/store.svelte');
    const measured: [string, number][] = [
      ['Les fées dansent dans la clairière point', 76.6],
      ['Elles chantent virgule et les oiseaux les écoutent point', 59.6],
      ['Le petit dragon regarde les étoiles au-dessus de la montagne point à la ligne', 58.2],
    ];
    const timed = async (text: string, rate: number, muted: boolean, msPerChar: number): Promise<number> => {
      audioSettings.voice = { volume: 1, muted };
      (globalThis as any).speechSynthesis.speak = (u: any) => void setTimeout(() => u.onend?.(), (u.text.length * msPerChar) / u.rate);
      const t0 = Date.now();
      let end = 0;
      void speak(text, { rate }).then(() => (end = Date.now()));
      while (!end) await vi.advanceTimersByTimeAsync(10);
      return end - t0;
    };
    for (const rate of Object.values(PACE_RATES)) {
      for (const [text, msPerChar] of measured) {
        const spoken = await timed(text, rate, false, msPerChar);
        const muted = await timed(text, rate, true, msPerChar);
        expect(Math.abs(muted - spoken) / spoken, `${text} at ${rate}: spoken ${spoken} ms, muted ${muted} ms`).toBeLessThanOrEqual(0.2);
      }
    }
  });

  // The script's pauses are the runner's own `wait` steps: a muted chunk read twice at pace 3, with
  // its pauses, takes the time a spoken one does (within 20 %).
  it('keeps a whole chunk\'s pace muted, its pauses included (pace 3)', async () => {
    vi.useFakeTimers();
    const { audioSettings } = await import('../audio/store.svelte');
    const steps = buildScript(buildPlan('Le petit dragon regarde les étoiles au-dessus de la montagne.'), 3);
    const run = async (muted: boolean): Promise<number> => {
      audioSettings.voice = { volume: 1, muted };
      (globalThis as any).speechSynthesis.speak = (u: any) => void setTimeout(() => u.onend?.(), (u.text.length * 58.2) / u.rate);
      let finished = 0;
      const t0 = Date.now();
      const runner = createRunner(steps, {
        pace: 3,
        speak: (s, rate) => speak(s, { rate }),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        cancel: () => undefined,
        onChange: (s) => {
          if (s.status === 'finished') finished = Date.now();
        },
      });
      runner.start();
      while (!finished) await vi.advanceTimersByTimeAsync(10);
      return finished - t0;
    };
    const spoken = await run(false);
    const muted = await run(true);
    expect(Math.abs(muted - spoken) / spoken, `spoken ${spoken} ms, muted ${muted} ms`).toBeLessThanOrEqual(0.2);
  });

  // Lane A review #3: a line whose end event never comes (iOS) must not keep the music down forever.
  // Final review I2: nor keep the dictation waiting - speak() resolves as if the line had ended.
  it('lets the music back up and the caller go on once a line has run far past its length without an end event', async () => {
    vi.useFakeTimers();
    const { audio } = await import('../audio/audio.svelte');
    const synth = (globalThis as any).speechSynthesis;
    synth.speak = () => {
      synth.speaking = true; // never ends
    };
    const text = 'Une phrase.';
    let done = false;
    void speak(text, { rate: 0.5 }).then(() => (done = true));
    expect(audio().snapshot().voiceSpeaking).toBe(true);
    const max = (text.length * 150) / 0.5 + 3000;
    await vi.advanceTimersByTimeAsync(max - 1);
    expect(audio().snapshot().voiceSpeaking).toBe(true);
    expect(done).toBe(false);
    const cancels = synth.cancel.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);
    expect(audio().snapshot().voiceSpeaking).toBe(false);
    expect(done).toBe(true);
    // The stuck voice is silenced, so the next line does not talk over it.
    expect(synth.cancel.mock.calls.length).toBe(cancels + 1);
  });

  it('lets the caller go on after a lost end event even when the engine says it is no longer speaking', async () => {
    vi.useFakeTimers();
    const synth = (globalThis as any).speechSynthesis;
    synth.speak = () => undefined; // never ends, never says it speaks
    let done = false;
    void speak('Six.', { rate: 1 }).then(() => (done = true));
    const cancels = synth.cancel.mock.calls.length;
    await vi.advanceTimersByTimeAsync((4 * 150) / 1 + 3000);
    expect(done).toBe(true);
    expect(synth.cancel.mock.calls.length).toBe(cancels);
  });

  // Lane A review #10: a cancel lands between speak() and its deferred start (iOS settle tick).
  it('never starts a line cancelled during its settle tick, and lets its caller go on', async () => {
    vi.useFakeTimers();
    const { audio } = await import('../audio/audio.svelte');
    const said: string[] = [];
    (globalThis as any).speechSynthesis.speaking = true;
    (globalThis as any).speechSynthesis.speak = (u: any) => void said.push(u.text);
    let done = false;
    void speak('Trop tard.', { rate: 1 }).then(() => (done = true));
    cancelSpeech();
    await vi.advanceTimersByTimeAsync(100);
    expect(said).toEqual([]);
    expect(done).toBe(true);
    expect(audio().snapshot().voiceSpeaking).toBe(false);
  });

  it('lets the music back up when a speech is cancelled without its end event (iOS)', async () => {
    const { audio } = await import('../audio/audio.svelte');
    (globalThis as any).speechSynthesis.speak = () => undefined; // never ends
    void speak('Trois.', { rate: 1 });
    expect(audio().snapshot().voiceSpeaking).toBe(true);
    cancelSpeech();
    expect(audio().snapshot().voiceSpeaking).toBe(false);
  });

  it('keeps the music down when a cancelled line ends late, under the next one', async () => {
    const { audio } = await import('../audio/audio.svelte');
    const said: any[] = [];
    (globalThis as any).speechSynthesis.speak = (u: any) => void said.push(u);
    void speak('Quatre.', { rate: 1 });
    void speak('Cinq.', { rate: 1 });
    said[0].onend?.();
    expect(audio().snapshot().voiceSpeaking).toBe(true);
    said[1].onend?.();
    expect(audio().snapshot().voiceSpeaking).toBe(false);
  });
});
