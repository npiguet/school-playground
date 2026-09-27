// Thin wrapper around the Web Speech API (`speechSynthesis`). Target
// platforms: iPad Safari (voices load asynchronously via 'voiceschanged';
// speech must be unlocked from a user gesture) and Edge/Chrome on Windows.
// `speechSynthesis` is always read from `globalThis` at call time (never
// cached at import) so tests (and Playwright) can stub it.
import { voiceGain, voiceMuted, voiceSpeaking } from '../audio/voice';

const NATURAL_RE = /natural|premium|enhanced|amélior/i;

// A short tick (ms) to defer synth.speak() by after synth.cancel(), but only
// when something was actually speaking/pending. Works around iOS Safari
// sometimes silently no-op'ing a speak() called immediately after cancel().
const CANCEL_SETTLE_MS = 30;

// Module-level reference to the utterance currently being spoken. Some
// browsers (notably iOS Safari) can garbage-collect a SpeechSynthesisUtterance
// mid-speech if nothing keeps it alive outside the closure passed to
// speechSynthesis.speak(); holding a reference here prevents that.
let activeUtterance: SpeechSynthesisUtterance | null = null;
// Bumped by every speak() and cancelSpeech(): a line deferred by the settle tick starts only if
// nothing came after it.
let speechToken = 0;

export function ttsAvailable(): boolean {
  return typeof (globalThis as any).speechSynthesis !== 'undefined';
}

export function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const synth = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
  if (!synth) return Promise.resolve([]);

  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.('voiceschanged', onVoicesChanged);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const onVoicesChanged = () => finish();
    synth.addEventListener?.('voiceschanged', onVoicesChanged);
    const timer = setTimeout(finish, timeoutMs);
  });
}

export function listFrenchVoices(
  voices: SpeechSynthesisVoice[] = (globalThis as any).speechSynthesis?.getVoices() ?? []
): SpeechSynthesisVoice[] {
  const french = voices.filter((v) => v.lang.toLowerCase().startsWith('fr'));

  const rank = (v: SpeechSynthesisVoice): number => {
    if (NATURAL_RE.test(v.name)) return 0;
    const lang = v.lang.toLowerCase();
    if (lang.startsWith('fr-ch')) return 1;
    if (lang.startsWith('fr-fr')) return 2;
    return 3;
  };

  return [...french].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredName?: string | null
): SpeechSynthesisVoice | undefined {
  if (preferredName) {
    const match = voices.find((v) => v.name === preferredName);
    if (match) return match;
  }
  return listFrenchVoices(voices)[0];
}

/**
 * How fast a voice speaks French at rate 1: about 15 characters a second, i.e. 65 ms a character of
 * the spoken form (its spaces and its said punctuation, « virgule », « point », included). Final
 * review I1: this is what a muted voice (Ruling E7b) and a missing speech engine wait instead of the
 * line, so the dictation keeps the pace the adult reading it aloud expects. Divided by the line's
 * rate like the voice itself (PACE_RATES 0.75-1.0): a slower pace waits longer. The script's own
 * pauses (its `wait` steps: 600 ms between a chunk's two readings, then pauseMs) come after it
 * exactly as after a spoken line.
 * Calibrated (UI5 fix wave A) against the e2e WebKit's own speechSynthesis (Flite) on three dictation
 * lines of 40, 56 and 77 characters at rates 0.75, 0.9 and 1: 76.6, 59.6 and 58.2 ms a character at
 * rate 1 (62.9 over the three), each line's time exactly inversely proportional to the rate. The
 * review's figure for French voices at the dictation rates, 65-90 ms a character at 0.75-1.0, is
 * 49-90 at rate 1. 65 lies within 20 % of every measured line (tts.test.ts pins it).
 */
export const SPEECH_MS_PER_CHAR = 65;

/** How long a French voice takes to say `text` at `rate`, in ms (at least 300). */
export function speechMs(text: string, rate: number): number {
  return Math.max(300, (text.length * SPEECH_MS_PER_CHAR) / rate);
}

/** A line said by nobody (no speech engine, or the voice muted) takes the time the voice would. */
const silentLine = (text: string, rate: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, speechMs(text, rate)));

/** How long a line may run before its missing end event is given up on (lane A review #3). */
const watchdogMs = (text: string, rate: number): number => (text.length * 150) / rate + 3000;

export function speak(text: string, opts: { rate: number; voice?: SpeechSynthesisVoice | null }): Promise<void> {
  const synth = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
  if (!synth) return silentLine(text, opts.rate);

  // Capture this before cancel(), which clears speaking/pending immediately.
  const wasActive = Boolean(synth.speaking || synth.pending);
  synth.cancel();
  const token = ++speechToken;

  // UI5 Ruling E7b (lane A review #2): iOS ignores an utterance's volume, so a muted voice is not
  // spoken at all; the line still takes its time, so the dictation keeps its pace everywhere.
  if (voiceMuted()) {
    activeUtterance = null;
    voiceSpeaking(false);
    return silentLine(text, opts.rate);
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = opts.voice?.lang ?? 'fr-FR';
    utterance.rate = opts.rate;
    utterance.pitch = 1;
    if (opts.voice) utterance.voice = opts.voice;
    // UI5 Ruling E7: the voice channel's gain (where the browser honours it).
    utterance.volume = voiceGain();
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(watchdog);
      // A cancelled line whose end event arrives late must not let the music up under a newer one.
      if (activeUtterance === utterance) {
        activeUtterance = null;
        voiceSpeaking(false);
      }
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    const startSpeaking = () => {
      // Lane A review #10: a cancel (or a newer line) during the settle tick wins: never start.
      if (token !== speechToken) {
        resolve();
        return;
      }
      activeUtterance = utterance;
      // UI5 Ruling E5: the music is down before the first word.
      voiceSpeaking(true);
      // An end event that never comes (iOS): the line is long gone. Final review I2: as if it had
      // ended - the music comes back up and the dictation goes on (the runner awaits this promise).
      // A voice somehow still going is silenced first, so the next line does not talk over it.
      watchdog = setTimeout(() => {
        if (activeUtterance === utterance && synth.speaking) synth.cancel();
        finish();
      }, watchdogMs(text, opts.rate));
      synth.speak(utterance);
    };

    // iOS Safari can silently no-op a speak() issued right after cancel();
    // give it a short tick to settle first, but only when there was
    // something to cancel (otherwise this would just add latency for no
    // reason on every single line).
    if (wasActive) {
      setTimeout(startSpeaking, CANCEL_SETTLE_MS);
    } else {
      startSpeaking();
    }
  });
}

export function cancelSpeech(): void {
  const synth = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
  synth?.cancel();
  speechToken++;
  // iOS may never send the cancelled line's end event: the music comes back up here.
  activeUtterance = null;
  voiceSpeaking(false);
}

/**
 * iOS Safari only lets `speechSynthesis` start from within a user gesture.
 * Speaking an empty utterance synchronously "unlocks" it for later async
 * calls. Must be called directly inside the tap handler that starts the
 * dictation. No-op when TTS is unavailable.
 */
export function unlockSpeech(): void {
  const synth = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
  if (!synth) return;
  synth.speak(new SpeechSynthesisUtterance(''));
}
