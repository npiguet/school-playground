import { describe, it, expect, vi } from 'vitest';
import { createRunner, unitStart } from './runner';
import type { Step } from './script';

const say = (i: number, repeat: 1 | 2 = 1): Step => ({ kind: 'say', text: `t${i}`, spoken: `s${i}`, rate: 0.85, label: 'chunk', unit: 'chunk', index: i, repeat });
const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(steps: Step[], pace: 1 | 2 | 3 | 4) {
  const spoken: string[] = []; const states: string[] = [];
  const cancel = vi.fn();
  const runner = createRunner(steps, {
    pace, speak: async (s) => { spoken.push(s); }, sleep: async () => {}, cancel,
    onChange: (st) => states.push(st.status),
  });
  return { runner, spoken, states, cancel };
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
      sleep: async () => {}, cancel: () => {}, onChange: () => {},
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
  it('pause() silences the in-flight utterance via cancel()', async () => {
    const cancel = vi.fn();
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(1), { kind: 'done' }], {
      pace: 3, speak: () => new Promise<void>(() => {}), sleep: async () => {}, cancel, onChange: () => {},
    });
    runner.start(); await flush();
    expect(runner.state().status).toBe('playing'); // still awaiting the never-resolving speak()
    expect(cancel).not.toHaveBeenCalled();
    runner.pause();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(runner.state().status).toBe('paused');
  });
  // UI4 Ruling M20: a resumed dictation restarts at the unit that was being read, not the first one.
  it('reports the unit being read, and a resumed runner starts there with the units before it done', async () => {
    const steps: Step[] = [
      say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'wait', ms: 3000 },
      say(1), { kind: 'wait', ms: 600 }, say(1, 2), { kind: 'wait', ms: 3000 },
      say(2), { kind: 'wait', ms: 600 }, say(2, 2), { kind: 'wait', ms: 3000 },
      { kind: 'done' },
    ];
    let release: (() => void) | null = null;
    const spoken: string[] = [];
    const runner = createRunner(steps, {
      pace: 3, speak: (s) => { spoken.push(s); return new Promise<void>((r) => { release = r; }); },
      sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start(); await flush();
    expect(runner.state().resumeAt).toBe(0);
    release!(); await flush(); // chunk 0's second reading
    expect(runner.state().resumeAt).toBe(0);
    release!(); await flush(); // chunk 1 starts
    expect(runner.state()).toMatchObject({ resumeAt: 4, done: 1 });
    release!(); await flush(); // chunk 1's second reading: still chunk 1
    expect(runner.state().resumeAt).toBe(4);

    // Saved mid-way through chunk 1's pause (step 7): the resumed runner reads chunk 1 again.
    expect(unitStart(steps, 7)).toBe(4);
    const again: string[] = [];
    const resumed = createRunner(steps, { pace: 3, speak: async (s) => { again.push(s); }, sleep: async () => {}, cancel: () => {}, onChange: () => {} }, 7);
    expect(resumed.state()).toMatchObject({ index: 4, resumeAt: 4, done: 1, total: 3 });
    resumed.start(); await flush(); await flush();
    expect(again[0]).toBe('s1');
    expect(spoken[0]).toBe('s0');
  });
  it('a manual pace resumes on the sentence it last read (she may still be writing it)', async () => {
    const steps: Step[] = [say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }];
    const { runner } = harness(steps, 1);
    runner.start(); await flush();
    runner.next(); await flush();
    expect(runner.state()).toMatchObject({ status: 'waiting', index: 4, resumeAt: 2, done: 2 });
    const spoken: string[] = [];
    const resumed = createRunner(steps, { pace: 1, speak: async (s) => { spoken.push(s); }, sleep: async () => {}, cancel: () => {}, onChange: () => {} }, 2);
    expect(resumed.state()).toMatchObject({ index: 2, done: 1 });
    resumed.start(); await flush();
    expect(spoken).toEqual(['s1']);
  });
  // Closing item 1: a resumed dictation must not get its « Réécouter » back.
  it('a resumed runner keeps the replays already spent, instead of the pace\'s full allowance', async () => {
    const steps: Step[] = [say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }];
    const { runner } = harness(steps, 2);
    runner.start(); await flush();
    expect(runner.state().replaysLeft).toBe(3);
    runner.replay(); await flush();
    expect(runner.state().replaysLeft).toBe(2);

    // Saved with 2 replays left, at the second unit: the resumed runner starts there, not refilled.
    const resumed = createRunner(steps, { pace: 2, speak: async () => {}, sleep: async () => {}, cancel: () => {}, onChange: () => {} }, 2, 2);
    expect(resumed.state()).toMatchObject({ index: 2, replaysLeft: 2 });

    // No override (an older save, or never replayed): the pace's full allowance, as before.
    const fresh = createRunner(steps, { pace: 2, speak: async () => {}, sleep: async () => {}, cancel: () => {}, onChange: () => {} }, 2);
    expect(fresh.state().replaysLeft).toBe(3);
  });

  it('stop() silences the in-flight utterance via cancel()', async () => {
    const { runner, cancel } = harness([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], 2);
    runner.start(); await flush();
    expect(cancel).not.toHaveBeenCalled();
    runner.stop();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('when the voice fails (spec 2026-09-27 §5.3)', () => {
  const failing = (failure: 'unreachable' | 'server') => Object.assign(new Error('voice'), { failure });

  it('passes the next line to be fetched ahead, then none after the last', async () => {
    const nexts: (string | null)[] = [];
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'wait', ms: 3000 }, say(1), { kind: 'done' }], {
      pace: 3, speak: async (_s, _r, next) => void nexts.push(next?.spoken ?? null), sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    expect(nexts).toEqual(['s0', 's1', null]);
  });

  it('pauses on the line it could not say, with the cause; « Réessayer » says it and carries on', async () => {
    let down = true;
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }], {
      pace: 2,
      speak: async (s) => {
        if (down) throw failing('unreachable');
        spoken.push(s);
      },
      sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'unreachable', index: 0, done: 0 });
    down = false;
    runner.retry();
    await flush();
    expect(spoken).toEqual(['s0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', failure: null, done: 1 });
  });

  it('a retry that fails again silences again, with the new cause (Review Focus 3)', async () => {
    const causes: ('unreachable' | 'server')[] = ['unreachable', 'server'];
    const runner = createRunner([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], {
      pace: 2, speak: async () => { throw failing(causes.shift() ?? 'server'); }, sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'unreachable' });
    runner.retry();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'server' });
  });

  it('a failed replay silences; « Réessayer » replays without spending a replay, then waits (Review Focus 4)', async () => {
    let down = false;
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], {
      pace: 2,
      speak: async (s) => {
        if (down) throw failing('server');
        spoken.push(s);
      },
      sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    down = true;
    runner.replay();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'server', replaysLeft: 2 });
    down = false;
    runner.retry();
    await flush();
    expect(spoken).toEqual(['s0', 's0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', failure: null, replaysLeft: 2 });
  });

  it('a pause wins over a failure that lands after it; a stopped runner says nothing more', async () => {
    let fail!: () => void;
    const states: string[] = [];
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'done' }], {
      pace: 3,
      speak: () => new Promise<void>((_, reject) => (fail = () => reject(failing('unreachable')))),
      sleep: async () => {}, cancel: () => {}, onChange: (s) => states.push(s.status),
    });
    runner.start();
    await flush();
    runner.pause();
    fail();
    await flush();
    expect(runner.state().status).toBe('paused');
    runner.stop();
    expect(states.at(-1)).toBe('paused');
  });
});
