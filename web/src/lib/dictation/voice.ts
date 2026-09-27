// The dictation's voice (spec 2026-09-27 §5): Kokoro on the server. Each line is fetched from
// /api/tts/speak (the game server proxies the `tts` service), kept as a blob URL for replays and the
// next line, and played by `playLine` on the voice channel (the music ducks, effects wait). A muted
// voice fetches nothing and waits the line's length. A failed fetch - a network error, a 5xx, or no
// answer within 20 s + 50 ms a character - is tried once more, silently; then speak() rejects with a
// VoiceError, which the runner turns into Éris's card (§5.3). There is no other voice (§2).
import { playLine, voiceMuted } from '../audio/voice';
import type { LineHandle, VoiceClip } from '../audio/engine';
import type { SayLine } from './script';

/**
 * How fast a voice speaks French at rate 1: 65 ms a character of the spoken form (its spaces and its
 * said punctuation included), divided by the line's rate. What a muted voice waits instead of the line
 * (UI5 Ruling E7b) and each clip's estimated length (Ruling K7). Calibrated in UI5 fix wave A.
 */
export const SPEECH_MS_PER_CHAR = 65;

/** How long a French voice takes to say `text` at `rate`, in ms (at least 300). */
export function speechMs(text: string, rate: number): number {
  return Math.max(300, (text.length * SPEECH_MS_PER_CHAR) / rate);
}

/** A line not back after this long shows the waiting line (§5.2). */
export const SLOW_MS = 400;
/** How long a line may take to come (§5.3). */
export const fetchTimeoutMs = (spoken: string): number => 20_000 + 50 * spoken.length;
/** The voice service's limit on one prepare (tts/app/main.py MAX_PREPARE_LINES). */
export const MAX_PREPARE_LINES = 500;

/** Ruling K6: `unreachable` (503, the network, the timeout) or `server` (any other error answer). */
export type VoiceFailure = 'unreachable' | 'server';

export class VoiceError extends Error {
  constructor(
    readonly failure: VoiceFailure,
    readonly retryable = true,
  ) {
    super(`voice: ${failure}`);
    this.name = 'VoiceError';
  }
}

export interface SpeakOpts {
  /** The line said after this one: fetched once this one starts playing (§5.2). */
  next?: SayLine | null;
  /** The line is more than SLOW_MS late. */
  onSlow?: () => void;
  /** The line starts playing. */
  onStart?: () => void;
}

export interface VoiceDeps {
  profileId: number;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  play?: (clip: VoiceClip) => LineHandle;
  muted?: () => boolean;
  toUrl?: (blob: Blob) => string;
  revoke?: (url: string) => void;
}

export interface Voice {
  /** Says a line; resolves when it has been played (or cancelled); rejects with a VoiceError. */
  speak(spoken: string, rate: number, opts?: SpeakOpts): Promise<void>;
  prefetch(line: SayLine): void;
  /** Sends a dictation's lines ahead to be recorded, in order (fire and forget). */
  prepare(lines: SayLine[]): void;
  /** Stops the line playing; a line still coming will not play. */
  cancel(): void;
  /** The dictation (or the lyre) is gone: every clip is freed. */
  dispose(): void;
}

export function createVoice(deps: VoiceDeps): Voice {
  const doFetch = deps.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
  const play = deps.play ?? playLine;
  const muted = deps.muted ?? voiceMuted;
  const toUrl = deps.toUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revoke = deps.revoke ?? ((url: string) => URL.revokeObjectURL(url));
  const clips = new Map<string, Promise<VoiceClip>>();
  const urls = new Set<string>();
  let generation = 0;
  let current: LineHandle | null = null;
  let disposed = false;

  const post = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  async function attempt(line: SayLine): Promise<VoiceClip> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), fetchTimeoutMs(line.spoken));
    try {
      const res = await doFetch('/api/tts/speak', {
        ...post({ profile_id: deps.profileId, text: line.spoken, speed: line.rate }),
        signal: abort.signal,
      });
      if (res.status === 503) throw new VoiceError('unreachable');
      if (res.status >= 500) throw new VoiceError('server');
      if (!res.ok) throw new VoiceError('server', false);
      const url = toUrl(await res.blob());
      if (disposed) {
        revoke(url);
        throw new VoiceError('unreachable', false);
      }
      urls.add(url);
      return { url, text: line.spoken, ms: speechMs(line.spoken, line.rate) };
    } catch (e) {
      if (e instanceof VoiceError) throw e;
      throw new VoiceError('unreachable'); // the network, or the timeout's abort
    } finally {
      clearTimeout(timer);
    }
  }

  function load(line: SayLine): Promise<VoiceClip> {
    const key = `${line.rate}|${line.spoken}`;
    const known = clips.get(key);
    if (known) return known;
    const made = attempt(line).catch((e: VoiceError) => (e.retryable && !disposed ? attempt(line) : Promise.reject(e)));
    clips.set(key, made);
    // A line that failed is asked for again next time.
    made.catch(() => {
      if (clips.get(key) === made) clips.delete(key);
    });
    return made;
  }

  function prefetch(line: SayLine): void {
    if (disposed || muted()) return;
    load(line).catch(() => undefined); // its own speak() reports the failure, if it still fails then
  }

  function cancel(): void {
    generation++;
    current?.stop();
    current = null;
  }

  return {
    async speak(spoken, rate, opts = {}) {
      cancel();
      const token = generation;
      if (muted()) {
        await new Promise((resolve) => setTimeout(resolve, speechMs(spoken, rate)));
        return;
      }
      const slow = setTimeout(() => {
        if (token === generation) opts.onSlow?.();
      }, SLOW_MS);
      let clip: VoiceClip;
      try {
        clip = await load({ spoken, rate });
      } catch (e) {
        if (token !== generation || disposed) return; // cancelled meanwhile: nobody waits for it
        throw e;
      } finally {
        clearTimeout(slow);
      }
      if (token !== generation || disposed) return;
      opts.onStart?.();
      const handle = play(clip);
      current = handle;
      if (opts.next) prefetch(opts.next);
      await handle.ended;
      if (current === handle) current = null;
    },
    prefetch,
    prepare(lines) {
      if (disposed || muted() || lines.length === 0) return;
      const body = { profile_id: deps.profileId, lines: lines.slice(0, MAX_PREPARE_LINES).map((l) => ({ text: l.spoken, speed: l.rate })) };
      void doFetch('/api/tts/prepare', post(body)).catch(() => undefined);
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
      for (const url of urls) revoke(url);
      urls.clear();
      clips.clear();
    },
  };
}
