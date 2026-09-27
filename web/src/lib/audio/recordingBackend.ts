// A backend that plays nothing and writes down what it was asked (Ruling E10): vitest's, and every
// e2e page's (window.__discordeAudioStub), whose engine state is read through window.__discordeAudio.
import type { AudioBackend, ContextState, LineHandle, VoiceClip } from './engine';
import type { SfxId, TrackId } from './catalog';

export interface Recorded {
  calls: string[];
  tracks: { id: TrackId; gain: number; stopped: boolean }[];
  sfx: { id: SfxId; gain: number }[];
  lines: { text: string; gain: number; ms: number; stopped: boolean }[];
  state: ContextState;
}

/** How long a recorded line lasts: the former speechSynthesis stub's 20 ms (Ruling K7), so the e2e
 *  suite keeps its pace; the line's real length is written down in `ms`. */
export const RECORDED_LINE_MS = 20;

export function recordingBackend(): AudioBackend & { log: Recorded } {
  const log: Recorded = { calls: [], tracks: [], sfx: [], lines: [], state: 'suspended' };
  return {
    log,
    track(id) {
      const t = { id, gain: 0, stopped: false };
      log.tracks.push(t);
      return {
        start(gain, ms) {
          t.gain = gain;
          log.calls.push(`start ${id} ${gain} ${ms}`);
        },
        fadeTo(gain, ms) {
          t.gain = gain;
          log.calls.push(`fade ${id} ${gain} ${ms}`);
        },
        stop(ms) {
          t.gain = 0;
          t.stopped = true;
          log.calls.push(`stop ${id} ${ms}`);
        },
      };
    },
    sfx(id, gain) {
      log.sfx.push({ id, gain });
    },
    warm() {},
    // resume/suspend change the state only: the lifecycle test expects no call before the unlock.
    resume() {
      log.state = 'running';
    },
    suspend() {
      log.state = 'suspended';
    },
    state: () => log.state,
    line(clip: VoiceClip, gain: number): LineHandle {
      const l = { text: clip.text, gain, ms: clip.ms, stopped: false };
      log.lines.push(l);
      let done!: () => void;
      const ended = new Promise<void>((resolve) => (done = resolve));
      const timer = setTimeout(done, RECORDED_LINE_MS);
      return {
        ended,
        stop() {
          l.stopped = true;
          clearTimeout(timer);
          done();
        },
        volume(g) {
          l.gain = g;
        },
      };
    },
  };
}
