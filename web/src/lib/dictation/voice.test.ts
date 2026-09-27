import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVoice, fetchTimeoutMs, SLOW_MS, SPEECH_MS_PER_CHAR, speechMs, VoiceError } from './voice';
import type { LineHandle, VoiceClip } from '../audio/engine';

type Call = { url: string; body: { profile_id: number; text?: string; speed?: number; lines?: unknown[] } };
type Respond = (call: Call, n: number, init: RequestInit) => Promise<Response> | Response;

const ok = () => new Response(new Blob(['mp3']), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
const status = (s: number) => new Response(JSON.stringify({ detail: 'x' }), { status: s });
const hang: Respond = (_c, _n, init) =>
  new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));

function harness(o: { respond?: Respond; muted?: boolean } = {}) {
  const calls: Call[] = [];
  const played: VoiceClip[] = [];
  const handles: { end: () => void; stopped: boolean }[] = [];
  const revoked: string[] = [];
  const muted = { on: o.muted ?? false };
  let made = 0;
  const voice = createVoice({
    profileId: 7,
    fetch: async (url, init) => {
      const call = { url, body: JSON.parse(String(init.body)) } as Call;
      calls.push(call);
      return o.respond ? o.respond(call, calls.length, init) : ok();
    },
    play: (clip): LineHandle => {
      played.push(clip);
      let end!: () => void;
      const ended = new Promise<void>((r) => (end = r));
      const h = { end, stopped: false };
      handles.push(h);
      return { ended, stop: () => ((h.stopped = true), end()), volume: () => {} };
    },
    muted: () => muted.on,
    toUrl: () => `blob:${++made}`,
    revoke: (u) => revoked.push(u),
  });
  return { voice, calls, played, handles, revoked, muted };
}
const speaks = (calls: Call[]) => calls.filter((c) => c.url === '/api/tts/speak').map((c) => c.body.text);

afterEach(() => vi.useRealTimers());

describe('the voice on the server (spec 2026-09-27 §5)', () => {
  it("fetches the line for this hero and plays it on the voice channel, resolving at its end", async () => {
    const { voice, calls, played, handles } = harness();
    let done = false;
    const p = voice.speak('Un matin. Point.', 0.75).then(() => (done = true));
    await vi.waitFor(() => expect(played).toHaveLength(1));
    expect(calls).toEqual([{ url: '/api/tts/speak', body: { profile_id: 7, text: 'Un matin. Point.', speed: 0.75 } }]);
    expect(played[0]).toEqual({ url: 'blob:1', text: 'Un matin. Point.', ms: speechMs('Un matin. Point.', 0.75) });
    expect(done).toBe(false);
    handles[0].end();
    await p;
    expect(done).toBe(true);
  });

  it("a muted voice fetches nothing and waits the line's length", async () => {
    vi.useFakeTimers();
    const { voice, calls, played } = harness({ muted: true });
    let done = false;
    void voice.speak('x'.repeat(10), 0.75).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(speechMs('x'.repeat(10), 0.75) - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(calls).toEqual([]);
    expect(played).toEqual([]);
  });

  it('says when a line is late (400 ms), then when it starts', async () => {
    vi.useFakeTimers();
    const said: string[] = [];
    const { voice } = harness({ respond: () => new Promise((r) => setTimeout(() => r(ok()), 1000)) });
    void voice.speak('Un.', 1, { onSlow: () => said.push('slow'), onStart: () => said.push('start') });
    await vi.advanceTimersByTimeAsync(SLOW_MS - 1);
    expect(said).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(said).toEqual(['slow']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(said).toEqual(['slow', 'start']);
  });

  it('is not late when the line comes quickly', async () => {
    vi.useFakeTimers();
    const said: string[] = [];
    const { voice } = harness();
    void voice.speak('Un.', 1, { onSlow: () => said.push('slow'), onStart: () => said.push('start') });
    await vi.advanceTimersByTimeAsync(SLOW_MS * 3);
    expect(said).toEqual(['start']);
  });

  it('tries a failed line once more, silently', async () => {
    const { voice, calls, played, handles } = harness({ respond: (_c, n) => (n === 1 ? status(500) : ok()) });
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    handles[0].end();
    await p;
    expect(speaks(calls)).toEqual(['Un.', 'Un.']);
  });

  it.each([
    [() => status(503), 'unreachable'],
    [() => status(500), 'server'],
    [() => status(502), 'server'],
    [() => Promise.reject(new TypeError('Failed to fetch')), 'unreachable'],
  ] as [Respond, string][])('fails after the retry with its cause (%#)', async (respond, failure) => {
    const { voice, calls, played } = harness({ respond });
    await expect(voice.speak('Un.', 1)).rejects.toMatchObject({ name: 'VoiceError', failure });
    expect(speaks(calls)).toEqual(['Un.', 'Un.']);
    expect(played).toEqual([]);
  });

  it('gives up on a line that never comes after its timeout, twice: « unreachable »', async () => {
    vi.useFakeTimers();
    const { voice, calls } = harness({ respond: hang });
    let failure: unknown = null;
    void voice.speak('Un.', 1).catch((e: VoiceError) => (failure = e.failure));
    await vi.advanceTimersByTimeAsync(fetchTimeoutMs('Un.'));
    expect(speaks(calls)).toEqual(['Un.', 'Un.']);
    await vi.advanceTimersByTimeAsync(fetchTimeoutMs('Un.'));
    expect(failure).toBe('unreachable');
    expect(fetchTimeoutMs('x'.repeat(100))).toBe(25_000);
  });

  it('does not try again a line the server refused (4xx): « server »', async () => {
    const { voice, calls } = harness({ respond: () => status(422) });
    await expect(voice.speak('Un.', 1)).rejects.toMatchObject({ failure: 'server' });
    expect(speaks(calls)).toEqual(['Un.']);
  });

  it('never plays a line cancelled while it was coming (a pause, « Quitter »)', async () => {
    vi.useFakeTimers();
    const { voice, played } = harness({ respond: () => new Promise((r) => setTimeout(() => r(ok()), 1000)) });
    let done = false;
    void voice.speak('Un.', 1).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(500);
    voice.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(true);
    expect(played).toEqual([]);
  });

  it('cancel() stops the line playing', async () => {
    const { voice, played, handles } = harness();
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    voice.cancel();
    await p;
    expect(handles[0].stopped).toBe(true);
  });

  it('fetches the next line once this one plays; the next line and a replay come from memory', async () => {
    const { voice, calls, played, handles } = harness();
    const first = voice.speak('Un.', 0.9, { next: { spoken: 'Deux.', rate: 0.9 } });
    await vi.waitFor(() => expect(played).toHaveLength(1));
    await vi.waitFor(() => expect(speaks(calls)).toEqual(['Un.', 'Deux.']));
    handles[0].end();
    await first;
    const second = voice.speak('Deux.', 0.9);
    await vi.waitFor(() => expect(played).toHaveLength(2));
    handles[1].end();
    await second;
    const again = voice.speak('Un.', 0.9);
    await vi.waitFor(() => expect(played).toHaveLength(3));
    handles[2].end();
    await again;
    expect(speaks(calls)).toEqual(['Un.', 'Deux.']);
  });

  it('asks again next time for a line that failed', async () => {
    let down = true;
    const { voice, calls, played, handles } = harness({ respond: () => (down ? status(503) : ok()) });
    await expect(voice.speak('Un.', 1)).rejects.toBeInstanceOf(VoiceError);
    down = false;
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    handles[0].end();
    await p;
    expect(speaks(calls)).toEqual(['Un.', 'Un.', 'Un.']);
  });

  it('dispose() frees every clip, and a clip landing after it is freed at once and never played', async () => {
    vi.useFakeTimers();
    let n = 0;
    const { voice, played, handles, revoked } = harness({ respond: () => (++n === 1 ? ok() : new Promise((r) => setTimeout(() => r(ok()), 1000))) });
    const p = voice.speak('Un.', 1);
    await vi.waitFor(() => expect(played).toHaveLength(1));
    handles[0].end();
    await p;
    void voice.speak('Deux.', 1);
    voice.dispose();
    expect(revoked).toEqual(['blob:1']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(revoked).toEqual(['blob:1', 'blob:2']);
    expect(played).toHaveLength(1);
  });

  it('says nothing once disposed: no fetch, and speak() resolves at once (lane W review #4)', async () => {
    const { voice, calls, played } = harness();
    voice.dispose();
    await voice.speak('Un.', 1);
    expect(calls).toEqual([]);
    expect(played).toEqual([]);
  });

  it('sends the lines ahead, in order, for this hero; a muted voice sends nothing', async () => {
    const { voice, calls, muted } = harness();
    voice.prepare([{ spoken: 'Un.', rate: 0.9 }, { spoken: 'Deux.', rate: 0.9 }]);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: '/api/tts/prepare', body: { profile_id: 7, lines: [{ text: 'Un.', speed: 0.9 }, { text: 'Deux.', speed: 0.9 }] } });
    muted.on = true;
    voice.prepare([{ spoken: 'Trois.', rate: 0.9 }]);
    voice.prefetch({ spoken: 'Trois.', rate: 0.9 });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(1);
  });

  it("waits what a voice takes for a muted line: 65 ms a character, divided by the rate, at least 300 ms", () => {
    expect(SPEECH_MS_PER_CHAR).toBe(65);
    expect(speechMs('abc', 1)).toBe(300);
    expect(speechMs('x'.repeat(100), 0.75)).toBeCloseTo((100 * 65) / 0.75);
  });
});
