import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildPlan, buildScript, replayLimit, pauseMs, defaultPace, PACE_LABELS, sayLines, MAX_LINE_CHARS } from './script';
import { spokenForm } from './spoken';

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
  it("names the paces in the camp's words (UI4 Ruling C8)", () => {
    expect(PACE_LABELS[3]).toEqual({ title: "D'un bon pas", description: 'Chaque groupe est lu deux fois, puis la voix enchaîne.' });
    expect(PACE_LABELS[4]).toEqual({ title: "D'une traite", description: 'Le texte entier est lu, puis dicté, puis relu une dernière fois. Pas de réécoute.' });
    expect([PACE_LABELS[1].title, PACE_LABELS[2].title]).toEqual(['Pas à pas', 'Par groupes']);
  });
});

describe('sayLines (spec 2026-09-27 §5.2: what the dictation sends ahead)', () => {
  const plan = buildPlan(TEXT);
  it('lists each line once, in the order the script first says it, at its pace', () => {
    expect(sayLines(buildScript(plan, 1))).toEqual(plan.sentences.map((s) => ({ spoken: spokenForm(s.text, { newParagraph: s.newParagraph }), rate: 0.75 })));
    expect(sayLines(buildScript(plan, 2))).toEqual(plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.85 })));
    // Pace 3 reads each chunk twice: once in the list.
    expect(sayLines(buildScript(plan, 3))).toEqual(plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.9 })));
  });
  it("keeps pace 4's two full readings apart: they are said at different rates", () => {
    expect(sayLines(buildScript(plan, 4))).toEqual([
      { spoken: plan.full, rate: 1.0 },
      ...plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.9 })),
      { spoken: plan.full, rate: 0.95 },
    ]);
  });
});

describe("the voice's limit (Kokoro plan Ruling K1)", () => {
  it("fits every seed text's longest line, pace 4's full reading", () => {
    expect(MAX_LINE_CHARS).toBe(10_000); // tts/app/text.py MAX_CHARS
    for (const f of readdirSync('../content/seed').filter((n) => n.endsWith('.json'))) {
      const body = (JSON.parse(readFileSync(`../content/seed/${f}`, 'utf-8')) as { body: string }).body;
      expect(buildPlan(body).full.length, f).toBeLessThanOrEqual(MAX_LINE_CHARS);
    }
  });
});
