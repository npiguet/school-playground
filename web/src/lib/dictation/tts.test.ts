import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cancelSpeech, listFrenchVoices, pickVoice, speak, ttsAvailable, unlockSpeech, waitForVoices } from './tts';

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
  afterEach(() => { delete (globalThis as any).speechSynthesis; delete (globalThis as any).SpeechSynthesisUtterance; });

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
    audioSettings.voice = { volume: 0.4, muted: true };
    await speak('Deux.', { rate: 1 });
    expect(volumes).toEqual([0.4, 0]);
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
