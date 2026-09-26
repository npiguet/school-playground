import { describe, it, expect, beforeEach } from 'vitest';
import { renderSfx, playSfx, type Sfx } from './sfx';
import { audioSettings } from '../audio/store.svelte';

const SFX_NAMES: Sfx[] = ['tap', 'seal', 'unroll', 'chime', 'growth', 'hmpf', 'laurel'];

/** Minimal chainable node stub: `connect` returns itself so `.connect(a).connect(b)` works,
 *  and `start`/`stop` just record the scheduled times. */
function makeNode() {
  const node: any = {
    starts: [] as number[],
    stops: [] as number[],
    connect: (_dest: unknown) => node,
    start: (at = 0) => node.starts.push(at),
    stop: (at = 0) => node.stops.push(at),
  };
  return node;
}

function makeStubContext() {
  const nodes: any[] = [];
  const ctx = {
    sampleRate: 44100,
    createOscillator: () => {
      const n = makeNode();
      n.type = 'sine';
      n.frequency = {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      };
      nodes.push(n);
      return n;
    },
    createGain: () => {
      const n = makeNode();
      n.gain = {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      };
      nodes.push(n);
      return n;
    },
    createBuffer: (_channels: number, length: number, sampleRate: number) => ({
      getChannelData: () => new Float32Array(length),
      length,
      sampleRate,
    }),
    createBufferSource: () => {
      const n = makeNode();
      n.buffer = null;
      nodes.push(n);
      return n;
    },
    createBiquadFilter: () => {
      const n = makeNode();
      n.type = 'lowpass';
      n.frequency = { setValueAtTime: () => {} };
      nodes.push(n);
      return n;
    },
    destination: {},
  };
  return { ctx: ctx as unknown as BaseAudioContext, nodes };
}

beforeEach(() => {
  audioSettings.sfx.muted = false;
});

describe('renderSfx', () => {
  for (const name of SFX_NAMES) {
    it(`schedules at least one node and stops within 0.7s of "at" for "${name}"`, () => {
      const { ctx, nodes } = makeStubContext();
      const at = 1.5;
      renderSfx(name, ctx, at);

      const started = nodes.filter((n) => n.starts.length > 0);
      expect(started.length).toBeGreaterThanOrEqual(1);

      // Each node stops within 0.7s of its OWN scheduled start (not the sfx's overall
      // "at"): a chord like "growth" staggers several tones after "at", each short.
      for (const n of started) {
        const startAt = n.starts[0];
        expect(startAt).toBeGreaterThanOrEqual(at);
        for (const stopAt of n.stops) {
          expect(stopAt - startAt).toBeLessThanOrEqual(0.7);
          expect(stopAt).toBeGreaterThanOrEqual(startAt);
        }
      }
    });
  }
});

describe('playSfx', () => {
  it('is a no-op when muted, without needing a context', () => {
    audioSettings.sfx.muted = true;
    expect(() => playSfx('tap')).not.toThrow();
  });
});
