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
  it('pace 4: full reading a sentence at a time, chunks twice, final full reading (Ruling R-A1)', () => {
    const steps = buildScript(plan, 4);
    const reading = (rate: number, repeat: 1 | 2) =>
      plan.sentences.map((s, i) => ({
        kind: 'say',
        text: s.text,
        spoken: spokenForm(s.text, { newParagraph: s.newParagraph }),
        rate,
        label: 'full',
        unit: 'full',
        index: i,
        repeat,
      }));
    // The sentences back to back: no wait between them, only the voice's own gap.
    expect(steps.slice(0, 2)).toEqual(reading(1.0, 1));
    expect(steps[2]).toEqual({ kind: 'wait', ms: 2000 });
    expect(steps.slice(-4, -1)).toEqual([{ kind: 'wait', ms: 1000 }, ...reading(0.95, 2)]);
    expect(steps.at(-1)).toEqual({ kind: 'done' });
    // The same words as the whole text read as one line.
    expect(reading(1.0, 1).map((s) => s.spoken).join(' ')).toBe(plan.full);
  });
  it("pace 4: a reading's paragraph break stays on its sentence", () => {
    const p = buildPlan('Le loup arriva.\n\nLes brebis dormaient.');
    const spoken = buildScript(p, 4).filter((s) => s.kind === 'say' && s.label === 'full').map((s) => (s as { spoken: string }).spoken);
    expect(spoken).toHaveLength(4);
    expect(spoken[1]).toBe(spokenForm('Les brebis dormaient.', { newParagraph: true }));
    expect(spoken[1]).toMatch(/^À la ligne/);
  });
  it('pace 4: only chunk steps count as progress units, not the bookend full reads', () => {
    const sayLabels = buildScript(plan, 4)
      .filter((s) => s.kind === 'say')
      .map((s) => [s.label, (s as { unit: string }).unit]);
    expect(sayLabels).toEqual([
      ['full', 'full'],
      ['full', 'full'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['chunk', 'chunk'],
      ['full', 'full'],
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
  it("sends pace 4's sentences first, in order, and keeps its two full readings apart: different rates", () => {
    const sentences = plan.sentences.map((s) => spokenForm(s.text, { newParagraph: s.newParagraph }));
    expect(sayLines(buildScript(plan, 4))).toEqual([
      ...sentences.map((spoken) => ({ spoken, rate: 1.0 })),
      ...plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.9 })),
      ...sentences.map((spoken) => ({ spoken, rate: 0.95 })),
    ]);
  });
  it('says a sentence repeated in the text once in the list: the same line, from the same clip', () => {
    const p = buildPlan('Il pleut. Le loup attend. Il pleut.');
    const lines = sayLines(buildScript(p, 4)).filter((l) => l.rate === 1.0);
    expect(lines.map((l) => l.spoken)).toEqual([spokenForm('Il pleut.'), spokenForm('Le loup attend.')]);
  });
});

describe("the voice's limit (Kokoro plan Ruling K1, a guard since Ruling R-A1)", () => {
  it("fits every seed text's longest line at every pace: a sentence", () => {
    expect(MAX_LINE_CHARS).toBe(10_000); // tts/app/text.py MAX_CHARS
    for (const f of readdirSync('../content/seed').filter((n) => n.endsWith('.json'))) {
      const body = (JSON.parse(readFileSync(`../content/seed/${f}`, 'utf-8')) as { body: string }).body;
      const plan = buildPlan(body);
      const longest = Math.max(...([1, 2, 3, 4] as const).flatMap((pace) => sayLines(buildScript(plan, pace)).map((l) => l.spoken.length)));
      const sentence = Math.max(...plan.sentences.map((s) => spokenForm(s.text, { newParagraph: s.newParagraph }).length));
      expect(longest, f).toBe(sentence);
      expect(longest, f).toBeLessThanOrEqual(MAX_LINE_CHARS);
    }
  });
});
