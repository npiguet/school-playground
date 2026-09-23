import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listFrenchVoices, pickVoice, speak, ttsAvailable, unlockSpeech } from './tts';

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
});
