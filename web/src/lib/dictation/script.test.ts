import { describe, it, expect } from 'vitest';
import { buildPlan, buildScript, replayLimit, pauseMs, defaultPace } from './script';

const TEXT = 'Le loup, affamé, arriva près de la bergerie. Les brebis dormaient.';

describe('buildPlan', () => {
  it('produces sentences and chunks with spoken forms', () => {
    const plan = buildPlan(TEXT);
    expect(plan.sentences).toHaveLength(2);
    expect(plan.chunks.map((c) => c.text)).toEqual(['Le loup, affamé,', 'arriva près de la bergerie.', 'Les brebis dormaient.']);
    expect(plan.chunks[0].spoken).toBe('Le loup, virgule, affamé, virgule.');
    expect(plan.chunks.map((c) => c.sentenceIndex)).toEqual([0, 0, 1]);
  });
});

describe('buildScript', () => {
  const plan = buildPlan(TEXT);
  it('pace 1: one sentence, then wait for the player', () => {
    const kinds = buildScript(plan, 1).map((s) => s.kind);
    expect(kinds).toEqual(['say', 'manual', 'say', 'manual', 'done']);
    const first = buildScript(plan, 1)[0];
    expect(first).toMatchObject({ kind: 'say', label: 'sentence', rate: 0.75, index: 0, repeat: 1 });
  });
  it('pace 2: one chunk, then wait', () => {
    expect(buildScript(plan, 2).map((s) => s.kind)).toEqual(['say', 'manual', 'say', 'manual', 'say', 'manual', 'done']);
    expect(buildScript(plan, 2)[0]).toMatchObject({ label: 'chunk', rate: 0.85 });
  });
  it('pace 3: each chunk twice, then a pause proportional to its length', () => {
    const steps = buildScript(plan, 3);
    expect(steps.slice(0, 4)).toEqual([
      expect.objectContaining({ kind: 'say', repeat: 1, rate: 0.9 }), { kind: 'wait', ms: 600 },
      expect.objectContaining({ kind: 'say', repeat: 2 }), { kind: 'wait', ms: pauseMs('Le loup, affamé,') },
    ]);
    expect(steps.at(-1)).toEqual({ kind: 'done' });
    expect(steps.filter((s) => s.kind === 'manual')).toHaveLength(0);
  });
  it('pace 4: full reading, chunks twice, final full reading', () => {
    const steps = buildScript(plan, 4);
    expect(steps[0]).toMatchObject({ kind: 'say', label: 'full', rate: 1.0, repeat: 1 });
    expect(steps[1]).toEqual({ kind: 'wait', ms: 2000 });
    expect(steps.at(-2)).toMatchObject({ kind: 'say', label: 'full', rate: 0.95, repeat: 2 });
    expect(steps.at(-1)).toEqual({ kind: 'done' });
  });
  it('pace 4: only chunk steps count as progress units, not the bookend full reads', () => {
    const sayLabels = buildScript(plan, 4)
      .filter((s) => s.kind === 'say')
      .map((s) => [s.label, (s as { unit: string }).unit]);
    expect(sayLabels).toEqual([
      ['full', 'full'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['full', 'full'],
    ]);
  });
});

describe('parameters', () => {
  it('replay limits and pauses', () => {
    expect(replayLimit(1)).toBe(Infinity); expect(replayLimit(2)).toBe(3); expect(replayLimit(3)).toBe(0); expect(replayLimit(4)).toBe(0);
    expect(pauseMs('un deux')).toBe(3600); expect(pauseMs('un')).toBe(3000);
  });
  it('default pace by level', () => {
    expect(defaultPace('5H')).toBe(1); expect(defaultPace('8H')).toBe(2); expect(defaultPace('10H')).toBe(3);
  });
});
