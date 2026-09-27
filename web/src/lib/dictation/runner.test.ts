import { describe, it, expect, vi } from 'vitest';
import { createRunner, unitBeingRead, unitStart, type RunnerDeps } from './runner';
import { buildPlan, buildScript, type Pace, type SayStep, type Step } from './script';

const say = (i: number, repeat: 1 | 2 = 1): Step => ({ kind: 'say', text: `t${i}`, spoken: `s${i}`, rate: 0.85, label: 'chunk', unit: 'chunk', index: i, repeat });
const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(steps: Step[], pace: Pace) {
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
    const { runner, spoken } = harness([say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }], 1);
    runner.start(); await flush();
    expect(spoken).toEqual(['s0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', done: 1, total: 2, replaysLeft: 1 });
    runner.next(); await flush();
    expect(spoken).toEqual(['s0', 's1']);
    runner.next(); await flush();
    expect(runner.state().status).toBe('finished');
  });
  // The pace redesign: pace I's « Réécouter » is one extra reading of the group, spent after one use
  // and given back for the next group.
  it('pace I: one replay per group, spent after one use, back at the next group', async () => {
    const { runner, spoken } = harness([say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }], 1);
    runner.start(); await flush();
    runner.replay(); await flush(); runner.replay(); await flush();
    expect(spoken).toEqual(['s0', 's0']);
    expect(runner.state().replaysLeft).toBe(0);
    runner.next(); await flush();
    expect(runner.state()).toMatchObject({ status: 'waiting', replaysLeft: 1 });
    runner.replay(); await flush(); runner.replay(); await flush();
    expect(spoken).toEqual(['s0', 's0', 's1', 's1']);
    expect(runner.state().replaysLeft).toBe(0);
  });
  it('pace I: the replay is the group heard last, once its two readings and its pauses are over', async () => {
    const steps = buildScript(buildPlan('Le loup, affamé, arriva près de la bergerie.'), 1);
    const { runner, spoken } = harness(steps, 1);
    runner.start(); await flush();
    expect(runner.state()).toMatchObject({ status: 'waiting', index: 5, done: 1 });
    expect(spoken).toEqual(['Le loup, virgule, affamé, virgule.', 'Le loup, virgule, affamé, virgule.']);
    runner.replay(); await flush();
    expect(spoken.at(-1)).toBe('Le loup, virgule, affamé, virgule.');
    expect(spoken).toHaveLength(3);
  });
  it('paces II and III give no replay', async () => {
    for (const pace of [2, 3] as const) {
      const spoken: string[] = [];
      const runner = createRunner([say(0), { kind: 'wait', ms: 3000 }, say(0, 2), { kind: 'done' }], {
        pace, speak: async (s) => void spoken.push(s), sleep: async () => {}, cancel: () => {}, onChange: () => {},
      });
      expect(runner.state().replaysLeft, String(pace)).toBe(0);
    }
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
  // The pace redesign: the replay is the group's, so a resume inside the group keeps it spent, and the
  // next group gives it back.
  it("a resumed runner keeps the group's replay spent, instead of the pace's full allowance", async () => {
    const steps: Step[] = [say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, say(2), { kind: 'manual', index: 2 }, { kind: 'done' }];
    const { runner } = harness(steps, 1);
    runner.start(); await flush();
    runner.next(); await flush();
    expect(runner.state().replaysLeft).toBe(1);
    runner.replay(); await flush();
    expect(runner.state().replaysLeft).toBe(0);

    // Saved with the replay spent, at the second group: the resumed runner starts there, not refilled.
    const resumed = createRunner(steps, { pace: 1, speak: async () => {}, sleep: async () => {}, cancel: () => {}, onChange: () => {} }, 2, 0);
    expect(resumed.state()).toMatchObject({ index: 2, replaysLeft: 0 });
    resumed.start(); await flush();
    expect(resumed.state()).toMatchObject({ status: 'waiting', replaysLeft: 0 });
    resumed.next(); await flush();
    expect(resumed.state()).toMatchObject({ status: 'waiting', index: 6, replaysLeft: 1 });

    // No override (an older save, or never replayed): the pace's full allowance, as before.
    const fresh = createRunner(steps, { pace: 1, speak: async () => {}, sleep: async () => {}, cancel: () => {}, onChange: () => {} }, 2);
    expect(fresh.state().replaysLeft).toBe(1);
  });

  it('stop() silences the in-flight utterance via cancel()', async () => {
    const { runner, cancel } = harness([say(0), { kind: 'manual', index: 0 }, { kind: 'done' }], 2);
    runner.start(); await flush();
    expect(cancel).not.toHaveBeenCalled();
    runner.stop();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

// Paces review, Important 1: « Groupe X sur Y » names the group being read, from its first reading on,
// never the count of groups already over.
describe('the unit being read (the progress line)', () => {
  const plan = buildPlan('Le loup, affamé, arriva près de la bergerie. Les brebis dormaient.');
  it('is the first group before anything is said, then each group from its first reading to the next, then the final reading', async () => {
    for (const pace of [1, 2, 3] as const) {
      const steps = buildScript(plan, pace);
      const releases: (() => void)[] = [];
      const wakes: (() => void)[] = [];
      let state = createRunner(steps, { pace, speak: async () => {}, sleep: async () => {}, cancel: () => {}, onChange: () => {} }).state();
      const runner = createRunner(steps, {
        pace,
        speak: () => new Promise<void>((r) => releases.push(r)),
        sleep: () => new Promise<void>((r) => wakes.push(r)),
        cancel: () => {},
        onChange: (s) => (state = s),
      });
      const reading = () => {
        const s = unitBeingRead(steps, state);
        return s && `${s.unit} ${s.index}`;
      };
      expect(reading(), `${pace}: before the start`).toBe('chunk 0');
      runner.start();
      await flush();
      expect(reading(), `${pace}: the first reading`).toBe('chunk 0');
      releases.shift()!();
      await flush();
      expect(reading(), `${pace}: the long pause`).toBe('chunk 0');
      wakes.shift()!();
      await flush();
      releases.shift()!();
      await flush();
      wakes.shift()!();
      await flush();
      if (pace === 1) {
        expect(reading(), '1: waiting for « Suivant »').toBe('chunk 0');
        runner.next();
        await flush();
      }
      expect(reading(), `${pace}: the second group's first reading`).toBe('chunk 1');
      runner.stop();
    }
    // A resumed dictation names the unit it resumes at, before its first line.
    const steps = buildScript(plan, 2);
    const closing = steps.findIndex((s) => s.kind === 'say' && s.unit === 'full');
    const at = (from: number) => {
      const r = createRunner(steps, { pace: 2, speak: async () => {}, sleep: async () => {}, cancel: () => {}, onChange: () => {} }, from);
      const s = unitBeingRead(steps, r.state());
      return s && `${s.unit} ${s.index}`;
    };
    expect(at(6)).toBe('chunk 1');
    expect(at(closing + 1)).toBe('full 0');
  });
});

// Fix wave A, Ruling R-A1: the full reading is said a sentence at a time; since the pace redesign it is
// read once, at the end, at every pace.
describe('the final reading, a sentence at a time', () => {
  const plan = buildPlan('Le loup arriva. Les brebis dormaient. Le berger veillait.');
  const steps = buildScript(plan, 2);
  const closing = steps.findIndex((s) => s.kind === 'say' && s.unit === 'full');
  const say4 = (i: number) => steps[i] as SayStep;
  function run(speak: RunnerDeps['speak'], from = closing) {
    const resumes: number[] = [];
    const runner = createRunner(steps, { pace: 2, speak, sleep: async () => {}, cancel: () => {}, onChange: (s) => resumes.push(s.resumeAt) }, from);
    return { runner, resumes };
  }

  it("only the reading's first sentence opens its unit: the resume point never moves inside it", async () => {
    expect(steps.slice(closing).map((s) => s.kind)).toEqual(['say', 'say', 'say', 'done']);
    const releases: (() => void)[] = [];
    const { runner, resumes } = run(() => new Promise<void>((r) => releases.push(r)));
    runner.start();
    await flush();
    expect(runner.state()).toMatchObject({ index: closing, resumeAt: closing, done: plan.chunks.length, total: plan.chunks.length });
    releases.shift()!();
    await flush();
    releases.shift()!();
    await flush();
    expect(runner.state()).toMatchObject({ index: closing + 2, resumeAt: closing }); // the third sentence
    expect(new Set(resumes)).toEqual(new Set([closing]));
    for (let i = closing; i < steps.length; i++) expect(unitStart(steps, i)).toBe(closing);
    expect([0, 1, 2].map((i) => say4(closing + i).index)).toEqual([0, 1, 2]);
    runner.stop();
  });

  it('a dictation saved inside a reading reads the whole text again, its groups before it counted', async () => {
    const spoken: string[] = [];
    const { runner } = run(async (s) => void spoken.push(s), closing + 2);
    expect(runner.state()).toMatchObject({ index: closing, resumeAt: closing, done: plan.chunks.length });
    runner.start();
    await flush();
    await flush();
    expect(spoken).toEqual([0, 1, 2].map((i) => say4(closing + i).spoken));
    expect(runner.state().status).toBe('finished');
  });

  it('a pause inside a reading resumes at the sentence it cut, not the reading\'s start', async () => {
    const releases: (() => void)[] = [];
    const spoken: string[] = [];
    const { runner } = run((s) => {
      spoken.push(s);
      return new Promise<void>((r) => releases.push(r));
    });
    runner.start();
    await flush();
    releases.shift()!();
    await flush();
    expect(runner.state().index).toBe(closing + 1);
    runner.pause();
    runner.resume();
    await flush();
    expect(spoken).toEqual([say4(closing).spoken, say4(closing + 1).spoken, say4(closing + 1).spoken]);
    expect(runner.state().resumeAt).toBe(closing);
    runner.stop();
  });

  it('« Réessayer » inside a reading says the sentence that failed, then carries on', async () => {
    let down = false;
    const spoken: string[] = [];
    let failed = false;
    const { runner } = run(async (s) => {
      if (down) throw Object.assign(new Error('voice'), { failure: 'unreachable' });
      spoken.push(s);
      if (!failed) down = failed = true; // the voice falls silent once, after the first sentence
    });
    runner.start();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'silenced', index: closing + 1, resumeAt: closing });
    down = false;
    runner.retry();
    await flush();
    await flush();
    expect(spoken.slice(0, 3)).toEqual([say4(closing).spoken, say4(closing + 1).spoken, say4(closing + 2).spoken]);
    expect(runner.state().status).toBe('finished');
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
      pace: 1,
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
    expect(runner.state()).toMatchObject({ status: 'silenced', failure: 'server', replaysLeft: 0 });
    down = false;
    runner.retry();
    await flush();
    expect(spoken).toEqual(['s0', 's0']);
    expect(runner.state()).toMatchObject({ status: 'waiting', failure: null, replaysLeft: 0 });
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

describe('a pause, then a resume before the paused line or wait settles (lane W review #1)', () => {
  it('a line still coming from before the pause ends nothing: no step skipped, no group counted twice', async () => {
    const releases: (() => void)[] = [];
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'manual', index: 0 }, say(1), { kind: 'manual', index: 1 }, { kind: 'done' }], {
      pace: 2,
      speak: (s) => {
        spoken.push(s);
        return new Promise<void>((r) => releases.push(r));
      },
      sleep: async () => {}, cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    runner.pause();
    runner.resume();
    await flush();
    expect(spoken).toEqual(['s0', 's0']);
    releases[0](); // the paused line settles late
    await flush();
    expect(runner.state()).toMatchObject({ status: 'playing', index: 0, done: 0 });
    releases[1]();
    await flush();
    expect(runner.state()).toMatchObject({ status: 'waiting', index: 2, done: 1 });
    expect(spoken).toEqual(['s0', 's0']);
  });

  it('a wait still running from before the pause ends nothing: no step skipped, no group counted twice', async () => {
    const wakes: (() => void)[] = [];
    const spoken: string[] = [];
    const runner = createRunner([say(0), { kind: 'wait', ms: 600 }, say(0, 2), { kind: 'wait', ms: 3000 }, say(1), { kind: 'done' }], {
      pace: 3,
      speak: async (s) => void spoken.push(s),
      sleep: () => new Promise<void>((r) => wakes.push(r)),
      cancel: () => {}, onChange: () => {},
    });
    runner.start();
    await flush();
    expect(runner.state()).toMatchObject({ index: 1, done: 1 });
    runner.pause();
    runner.resume();
    await flush();
    wakes[0](); // the paused wait ends late
    await flush();
    expect(runner.state()).toMatchObject({ status: 'playing', index: 1, done: 1 });
    expect(spoken).toEqual(['s0']);
    wakes[1]();
    await flush();
    expect(spoken).toEqual(['s0', 's0']);
    expect(runner.state()).toMatchObject({ status: 'playing', index: 3, done: 1 });
    expect(wakes).toHaveLength(3);
  });
});
