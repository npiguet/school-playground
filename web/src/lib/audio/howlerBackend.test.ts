import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { FakeHowl, made, ctx } = vi.hoisted(() => {
  const made: InstanceType<typeof FakeHowl>[] = [];
  const ctx = { state: 'suspended', resume: vi.fn(async () => void (ctx.state = 'running')), suspend: vi.fn(async () => void (ctx.state = 'suspended')) };
  // Howler 2.2.4 as it really behaves (lane A review, fix round 1 #1): a new fade or a volume() set
  // on a sound that is fading stops that fade and emits its 'fade' at once; a fade from a volume to
  // the same volume never completes (no 'fade' ever). `completeFade()` stands for the fade's end.
  class FakeHowl {
    handlers = new Map<string, ((id?: number) => void)[]>();
    calls: string[] = [];
    vol = 1;
    fading = false;
    constructor(public opts: { src: string[]; sprite?: Record<string, [number, number, boolean?]>; html5?: boolean }) {
      made.push(this);
    }
    once(ev: string, fn: () => void) {
      this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn]);
      return this;
    }
    emit(ev: string) {
      const fns = this.handlers.get(ev) ?? [];
      this.handlers.delete(ev);
      fns.forEach((f) => f());
    }
    stopFade() {
      if (!this.fading) return;
      this.fading = false;
      this.emit('fade');
    }
    completeFade() {
      if (this.fading && !this.stuck) this.stopFade();
    }
    stuck = false;
    st: 'unloaded' | 'loading' | 'loaded' = 'loaded';
    state() {
      return this.st;
    }
    duration() {
      return 60 + 2048 / 44100;
    }
    play(sprite?: string) {
      this.calls.push(`play ${sprite ?? ''}`.trim());
      return 7;
    }
    fade(from: number, to: number, ms: number) {
      this.stopFade();
      this.vol = to;
      this.fading = true;
      this.stuck = from === to;
      this.calls.push(`fade ${from}->${to} ${ms}`);
      return this;
    }
    // Howler: volume() and volume(soundId) read (an id is > 1); volume(v) and volume(v, id) set.
    volume(v?: number, id?: number) {
      if (v === undefined || (id === undefined && v > 1)) return this.vol;
      this.stopFade();
      this.vol = v;
      this.calls.push(`volume ${v}`);
      return this;
    }
    unload() {
      this.calls.push('unload');
    }
  }
  return { FakeHowl, made, ctx };
});
vi.mock('howler', () => ({ Howl: FakeHowl, Howler: { ctx } }));
vi.mock('./meta.gen.json', () => ({ default: { camp: { samples: 60 * 44100, rate: 44100, priming: 1024 } } }));

import { Howler } from 'howler';
import { howlerBackend } from './howlerBackend';

beforeEach(() => {
  made.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('the Howler backend (iPad Safari, Rulings E3 and E9)', () => {
  it('builds the loop from a probe once its length is known, skipping the priming, and fades it in', () => {
    const b = howlerBackend();
    const h = b.track('camp');
    h.start(0.4, 1200);
    expect(made).toHaveLength(1);
    made[0].emit('load');
    const loop = made[1];
    expect(loop.opts.src).toEqual(['/audio/music/camp.m4a']);
    expect(loop.opts.html5).toBeFalsy();
    const [start, length, looped] = loop.opts.sprite!.loop;
    expect(start).toBeCloseTo((1024 / 44100) * 1000, 3);
    expect(length).toBeCloseTo(60000, 3);
    expect(looped).toBe(true);
    expect(loop.calls).toEqual(['play loop', 'fade 0->0.4 1200']);
  });

  it('fades out, then frees the loop and its probe once the fade has had its time; a loop stopped while loading never plays', () => {
    const b = howlerBackend();
    const h = b.track('camp');
    h.start(0.5, 1200);
    made[0].emit('load');
    made[1].completeFade();
    h.stop(1200);
    expect(made[1].calls.at(-1)).toBe('fade 0.5->0 1200');
    vi.advanceTimersByTime(1200);
    expect(made[1].calls).not.toContain('unload');
    vi.advanceTimersByTime(50);
    expect(made[1].calls.at(-1)).toBe('unload');
    expect(made[0].calls.at(-1)).toBe('unload');
    const early = b.track('camp');
    early.stop(1200);
    made[2].emit('load');
    expect(made).toHaveLength(3);
    expect(made[2].calls).toEqual(['unload']);
  });

  it('never cuts a loop short when it is stopped mid fade-in (Howler ends the running fade at once)', () => {
    const b = howlerBackend();
    const h = b.track('camp');
    h.start(0.5, 1200);
    made[0].emit('load');
    // Still fading in: the stop's fade interrupts it, and Howler fires 'fade' right away.
    h.stop(1200);
    expect(made[1].calls).toEqual(['play loop', 'fade 0->0.5 1200', 'fade 0.5->0 1200']);
    expect(made[1].calls).not.toContain('unload');
    vi.advanceTimersByTime(1250);
    expect(made[1].calls.at(-1)).toBe('unload');
  });

  it('frees a loop playing at volume 0 (a fade from 0 to 0 never ends in Howler)', () => {
    const b = howlerBackend();
    const h = b.track('camp');
    h.start(0, 1200);
    made[0].emit('load');
    h.stop(1200);
    vi.advanceTimersByTime(1250);
    expect(made[1].calls.at(-1)).toBe('unload');
    expect(made[0].calls.at(-1)).toBe('unload');
  });

  it('skips a fade to the volume it already has', () => {
    const b = howlerBackend();
    const h = b.track('camp');
    h.start(0.5, 1200);
    made[0].emit('load');
    made[1].completeFade();
    h.fadeTo(0.502, 150);
    expect(made[1].calls).toEqual(['play loop', 'fade 0->0.5 1200']);
    h.fadeTo(0.15, 400);
    expect(made[1].calls.at(-1)).toBe('fade 0.5->0.15 400');
  });

  it('plays an effect at its gain, preloads the effects once, and drives the one context', () => {
    const b = howlerBackend();
    b.warm();
    const n = made.length;
    b.warm();
    expect(made.length).toBe(n);
    b.sfx('tap', 0.3);
    expect(made.find((m) => m.opts.src[0] === '/audio/sfx/tap.m4a')!.calls).toEqual(['play', 'volume 0.3']);
    b.resume();
    expect(ctx.resume).toHaveBeenCalled();
    expect(b.state()).toBe('running');
    b.suspend();
    expect(ctx.suspend).toHaveBeenCalled();
  });

  // Final review M4: hops across three places within a crossfade keep at most the one outgoing loop.
  it('frees an older loop still fading out when a new one starts: never three decoded loops', () => {
    const b = howlerBackend();
    const hop = (id: 'camp' | 'sea' | 'lair') => {
      const h = b.track(id);
      h.start(0.5, 1200);
      made.at(-1)!.emit('load');
      return { h, loop: made.at(-1)!, probe: made.at(-2)! };
    };
    const camp = hop('camp');
    camp.h.stop(1200);
    const sea = hop('sea');
    sea.h.stop(1200);
    expect(camp.loop.calls).not.toContain('unload');
    const lair = hop('lair');
    expect(camp.loop.calls.at(-1)).toBe('unload');
    expect(camp.probe.calls.at(-1)).toBe('unload');
    expect(sea.loop.calls).not.toContain('unload');
    expect(lair.loop.calls).not.toContain('unload');
    // Its own timer, later, frees nothing twice.
    vi.advanceTimersByTime(1250);
    expect(camp.loop.calls.filter((c) => c === 'unload')).toHaveLength(1);
    expect(sea.loop.calls.at(-1)).toBe('unload');
  });

  it("leaves the context's life to the engine: no Howler idle suspend (final review M5)", () => {
    howlerBackend();
    expect((Howler as unknown as { autoSuspend?: boolean }).autoSuspend).toBe(false);
  });

  it('drops an effect whose file is not loaded yet rather than play it late (final review M12)', () => {
    const b = howlerBackend();
    b.warm();
    const tap = made.find((m) => m.opts.src[0] === '/audio/sfx/tap.m4a')!;
    tap.st = 'loading';
    b.sfx('tap', 0.3);
    expect(tap.calls).toEqual([]);
    tap.st = 'loaded';
    b.sfx('tap', 0.3);
    expect(tap.calls).toEqual(['play', 'volume 0.3']);
  });

  it('stays silent over a file that cannot load: no throw, no play, one note per file (the files arrive later)', () => {
    const note = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const b = howlerBackend();
    const h = b.track('sea');
    h.start(0.5, 1200);
    made[0].emit('loaderror');
    expect(made).toHaveLength(1);
    expect(made[0].calls).toEqual(['unload']);
    expect(() => h.fadeTo(0.2, 400)).not.toThrow();
    expect(() => h.stop(1200)).not.toThrow();
    b.track('sea');
    made[1].emit('loaderror');
    b.sfx('seal', 0.5);
    const seal = made.find((m) => m.opts.src[0] === '/audio/sfx/seal.m4a')!;
    seal.emit('loaderror');
    b.sfx('seal', 0.5);
    expect(seal.calls).toEqual(['play', 'volume 0.5']);
    expect(note.mock.calls.map((c) => String(c[0]))).toEqual([
      expect.stringContaining('/audio/music/sea.m4a'),
      expect.stringContaining('/audio/sfx/seal.m4a'),
    ]);
    note.mockRestore();
  });
});
