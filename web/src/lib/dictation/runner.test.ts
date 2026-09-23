import { describe, it, expect } from 'vitest';
import { createRunner } from './runner';
import type { Step } from './script';

const say = (i: number, repeat: 1 | 2 = 1): Step => ({ kind: 'say', text: `t${i}`, spoken: `s${i}`, rate: 0.85, label: 'chunk', index: i, repeat });
const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(steps: Step[], pace: 1 | 2 | 3 | 4) {
  const spoken: string[] = []; const states: string[] = [];
  const runner = createRunner(steps, {
    pace, speak: async (s) => { spoken.push(s); }, sleep: async () => {},
    onChange: (st) => states.push(st.status),
  });
  return { runner, spoken, states };
}

describe('createRunner', () => {
  it('speaks, waits for the player on manual steps, and finishes', async () => {
    const { runner, spoken } = harness([say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }], 2);
    runner.start(); await flush();
    expect(spoken).toEqual(['s0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', done: 1, total: 2, replaysLeft: 3 });
    runner.next(); await flush();
    expect(spoken).toEqual(['s0', 's1']);
    runner.next(); await flush();
    expect(runner.state().status).toBe('finished');
  });
  it('replays the last utterance within the limit', async () => {
    const { runner, spoken } = harness([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], 2);
    runner.start(); await flush();
    runner.replay(); await flush(); runner.replay(); await flush(); runner.replay(); await flush(); runner.replay(); await flush();
    expect(spoken).toEqual(['s0', 's0', 's0', 's0']);
    expect(runner.state().replaysLeft).toBe(0);
  });
  it('pace 1 has unlimited replays', async () => {
    const { runner } = harness([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], 1);
    runner.start(); await flush();
    expect(runner.state().replaysLeft).toBe(Infinity);
  });
  it('runs automatic paces to the end and can pause/resume', async () => {
    let release: (() => void) | null = null;
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'wait', ms: 3000 }, say(1), { kind: 'done' }], {
      pace: 3, speak: (s) => { spoken.push(s); return new Promise<void>((r) => { release = r; }); },
      sleep: async () => {}, onChange: () => {},
    });
    runner.start(); await flush();
    expect(spoken).toEqual(['s0']);
    runner.pause(); release!(); await flush();
    expect(runner.state().status).toBe('paused');
    runner.resume(); await flush();
    expect(spoken).toEqual(['s0', 's0']); // the paused utterance is repeated
    release!(); await flush(); release!(); await flush(); release!(); await flush();
    expect(runner.state().status).toBe('finished');
  });
});
