// Thin wrapper around the Web Speech API (`speechSynthesis`). Target
// platforms: iPad Safari (voices load asynchronously via 'voiceschanged';
// speech must be unlocked from a user gesture) and Edge/Chrome on Windows.
// `speechSynthesis` is always read from `globalThis` at call time (never
// cached at import) so tests (and Playwright) can stub it.

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

export function speak(text: string, opts: { rate: number; voice?: SpeechSynthesisVoice | null }): Promise<void> {
  const synth = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
  if (!synth) {
    const delay = Math.max(300, text.length * 30);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Capture this before cancel(), which clears speaking/pending immediately.
  const wasActive = Boolean(synth.speaking || synth.pending);
  synth.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = opts.voice?.lang ?? 'fr-FR';
    utterance.rate = opts.rate;
    utterance.pitch = 1;
    if (opts.voice) utterance.voice = opts.voice;
    const finish = () => {
      activeUtterance = null;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    const startSpeaking = () => {
      activeUtterance = utterance;
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
