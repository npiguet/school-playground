import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  buildPlan,
  buildScript,
  replayLimit,
  longPauseMs,
  shortPauseMs,
  longGroups,
  defaultPace,
  toPace,
  DICTATION_RATE,
  PACES,
  PACE_LABELS,
  sayLines,
  MAX_LINE_CHARS,
} from './script';
import { countWords } from './segment';
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
  it('says « À la ligne » once, before the first group of a new paragraph, not before each of its groups', () => {
    const plan = buildPlan('Il pleut.\n\nLe loup, affamé, arriva près de la bergerie.');
    expect(plan.chunks.map((c) => c.spoken)).toEqual([
      'Il pleut. Point.',
      'À la ligne. Le loup, virgule, affamé, virgule.',
      'arriva près de la bergerie. Point.',
    ]);
    expect(plan.chunks.map((c) => c.newParagraph)).toEqual([false, true, false]);
  });
  it("ends only a sentence's last group with the sentence's close; a group cut on a word goes on (text 35)", () => {
    const body = (JSON.parse(readFileSync('../content/seed/035-muses-circe.json', 'utf-8')) as { body: string }).body;
    const plan = buildPlan(body);
    expect(plan.chunks.slice(0, 5).map((c) => c.spoken)).toEqual([
      "Quand les marins d'Ulysse débarquèrent sur l'île boisée,",
      'où régnait la magicienne Circé, virgule.',
      'ils furent accueillis par des lions,',
      'et des loups étrangement dociles, virgule.',
      'qui les frôlaient sans jamais montrer les crocs. Point.',
    ]);
    plan.chunks.forEach((c, i) => {
      const last = i === plan.chunks.length - 1 || plan.chunks[i + 1].sentenceIndex !== c.sentenceIndex;
      if (last) expect(c.spoken, c.text).toMatch(/\. Point\.$/);
      else expect(c.spoken, c.text).toMatch(/(, virgule\.|[\p{L}\p{N}],)$/u);
    });
  });
});

// The pace redesign (2026-09-27, pace-redesign-brief.md): three paces, all in breath groups, each group
// read twice (the long pause after the first reading, the short one after the second), the text read
// once in full at the end, a sentence at a time (Ruling R-A1), every line at one rate.
describe('buildScript (the pace redesign)', () => {
  const plan = buildPlan(TEXT);
  const [g0, g1, g2] = plan.chunks;
  const say = (text: string, spoken: string, index: number, repeat: 1 | 2) =>
    ({ kind: 'say', text, spoken, rate: 0.85, label: 'chunk', unit: 'chunk', index, repeat }) as const;
  const twice = (text: string, spoken: string, index: number) => [
    say(text, spoken, index, 1),
    { kind: 'wait', ms: longPauseMs(text) },
    say(text, spoken, index, 2),
    { kind: 'wait', ms: shortPauseMs(text) },
  ];
  const fullReading = plan.sentences.map((s, i) => ({
    kind: 'say',
    text: s.text,
    spoken: spokenForm(s.text, { newParagraph: s.newParagraph }),
    rate: 0.85,
    label: 'full',
    unit: 'full',
    index: i,
    repeat: 1,
  }));

  it('the pauses: the long one after the first reading, the short one after the second, both per word', () => {
    expect(longPauseMs('un')).toBe(3000);
    expect(longPauseMs('un deux')).toBe(3200);
    expect(longPauseMs('arriva près de la bergerie.')).toBe(8000);
    expect(shortPauseMs('un')).toBe(2000);
    expect(shortPauseMs('un deux trois')).toBe(2400);
    expect(shortPauseMs('arriva près de la bergerie.')).toBe(4000);
    expect(DICTATION_RATE).toBe(0.85);
  });
  it('pace I: each group twice, then waits for « Suivant »; the whole text once at the end', () => {
    expect(buildScript(plan, 1)).toEqual([
      ...twice(g0.text, g0.spoken, 0), { kind: 'manual', index: 0 },
      ...twice(g1.text, g1.spoken, 1), { kind: 'manual', index: 1 },
      ...twice(g2.text, g2.spoken, 2), { kind: 'manual', index: 2 },
      ...fullReading,
      { kind: 'done' },
    ]);
  });
  it('pace II: the same groups, twice each, moving on by itself; the whole text once at the end', () => {
    expect(buildScript(plan, 2)).toEqual([
      ...twice(g0.text, g0.spoken, 0),
      ...twice(g1.text, g1.spoken, 1),
      ...twice(g2.text, g2.spoken, 2),
      ...fullReading,
      { kind: 'done' },
    ]);
  });
  it("pace III: pace II's steps on longer groups (neighbours merged within a sentence)", () => {
    const merged = 'Le loup, affamé, arriva près de la bergerie.';
    expect(buildScript(plan, 3)).toEqual([
      ...twice(merged, 'Le loup, virgule, affamé, virgule, arriva près de la bergerie. Point.', 0),
      ...twice(g2.text, g2.spoken, 1),
      ...fullReading,
      { kind: 'done' },
    ]);
  });
  it('the final reading is the same words as the whole text, a paragraph break kept on its sentence', () => {
    expect(fullReading.map((s) => s.spoken).join(' ')).toBe(plan.full);
    const p = buildPlan('Le loup arriva.\n\nLes brebis dormaient.');
    for (const pace of [1, 2, 3] as const) {
      const full = buildScript(p, pace).filter((s) => s.kind === 'say' && s.label === 'full').map((s) => (s as { spoken: string }).spoken);
      expect(full, String(pace)).toEqual([spokenForm('Le loup arriva.'), spokenForm('Les brebis dormaient.', { newParagraph: true })]);
    }
  });
});

describe('longGroups (pace III: breath groups about twice as long)', () => {
  const body = (JSON.parse(readFileSync('../content/seed/035-muses-circe.json', 'utf-8')) as { body: string }).body;
  it("merges text 35's neighbouring groups while they stay at 20 words or fewer, never across a sentence", () => {
    const groups = longGroups(buildPlan(body).chunks);
    expect(groups.map((g) => [g.sentenceIndex, g.spoken])).toEqual([
      [0, "Quand les marins d'Ulysse débarquèrent sur l'île boisée où régnait la magicienne Circé, virgule, ils furent accueillis par des lions,"],
      [0, 'et des loups étrangement dociles, virgule, qui les frôlaient sans jamais montrer les crocs. Point.'],
      [1, "Circé, virgule, vêtue d'une robe tissée de fils d'argent, virgule, les invita dans son palais et leur offrit un vin doré, virgule."],
      [1, "parfumé d'herbes qu'elle seule connaissait. Point."],
      [2, 'Les hommes, virgule, affamés par leur longue traversée, virgule, burent sans méfiance. Point.'],
      [3, 'Aussitôt, virgule, leurs bras se couvrirent de soies rudes, virgule, leurs voix se changèrent en grognements, virgule.'],
      [3, 'et ils se retrouvèrent transformés en pourceaux, virgule, trottinant piteusement entre les colonnes du palais. Point.'],
      [4, 'Seul Euryloque, virgule, resté en arrière par prudence, virgule, échappa au sortilège et courut avertir Ulysse. Point.'],
      [5, "Celui-ci, virgule, protégé par une herbe magique que lui avait donnée le dieu Hermès, virgule, entra chez Circé sans crainte et exigea,"],
      [5, 'que ses compagnons retrouvent aussitôt leur forme humaine. Point.'],
    ]);
    expect(groups.map((g) => g.text)[0]).toBe("Quand les marins d'Ulysse débarquèrent sur l'île boisée où régnait la magicienne Circé, ils furent accueillis par des lions");
  });
  it('every seed text: at most 20 words a group, all the words kept in order, no group across a sentence', () => {
    for (const f of readdirSync('../content/seed').filter((n) => n.endsWith('.json'))) {
      const plan = buildPlan((JSON.parse(readFileSync(`../content/seed/${f}`, 'utf-8')) as { body: string }).body);
      const groups = longGroups(plan.chunks);
      expect(groups.length, f).toBeLessThanOrEqual(plan.chunks.length);
      for (const g of groups) expect(countWords(g.text), `${f}: ${g.text}`).toBeLessThanOrEqual(20);
      plan.sentences.forEach((s, i) => {
        expect(groups.filter((g) => g.sentenceIndex === i).map((g) => g.text).join(' '), f).toBe(plan.chunks.filter((c) => c.sentenceIndex === i).map((c) => c.text).join(' '));
      });
      // « À la ligne » stays on the first group of its sentence only.
      expect(groups.filter((g) => g.newParagraph).length, f).toBe(plan.chunks.filter((c) => c.newParagraph).length);
    }
  });
});

describe('parameters', () => {
  it('« Réécouter »: one per group at pace I, none at II and III', () => {
    expect([replayLimit(1), replayLimit(2), replayLimit(3)]).toEqual([1, 0, 0]);
  });
  it('default pace by level', () => {
    expect(defaultPace('5H')).toBe(1); expect(defaultPace('6H')).toBe(1);
    expect(defaultPace('7H')).toBe(2); expect(defaultPace('8H')).toBe(2);
    expect(defaultPace('9H')).toBe(3); expect(defaultPace('10H')).toBe(3); expect(defaultPace('11H')).toBe(3);
  });
  it('a saved pace: 1-3 as it is, the retired pace IV as III, anything else none', () => {
    expect([1, 2, 3, 4].map(toPace)).toEqual([1, 2, 3, 3]);
    for (const bad of [undefined, null, 0, 5, 2.5, '3']) expect(toPace(bad), String(bad)).toBeNull();
  });
  it("names the three paces in the camp's words (UI4 Ruling C8), pace IV gone", () => {
    expect(PACES).toEqual([1, 2, 3]);
    expect(PACE_LABELS).toEqual({
      1: { title: 'Pas à pas', description: "Chaque groupe est lu deux fois, puis la Pythie t'attend. Une réécoute par groupe." },
      2: { title: 'Par groupes', description: 'Chaque groupe est lu deux fois, puis la Pythie enchaîne. Tu peux faire une pause.' },
      3: { title: "D'un bon pas", description: 'Des groupes plus longs, lus deux fois, sans bouton pause : la Pythie enchaîne.' },
    });
  });
});

describe('sayLines (spec 2026-09-27 §5.2: what the dictation sends ahead)', () => {
  const plan = buildPlan(TEXT);
  const sentences = plan.sentences.map((s) => ({ spoken: spokenForm(s.text, { newParagraph: s.newParagraph }), rate: 0.85 }));
  it('lists each line once, in the order the script first says it: the groups, then the final reading', () => {
    const groups = plan.chunks.map((c) => ({ spoken: c.spoken, rate: 0.85 }));
    // « Les brebis dormaient. » is a group and a sentence of the reading: the same line, sent once.
    expect(groups[2]).toEqual(sentences[1]);
    expect(sayLines(buildScript(plan, 1))).toEqual([...groups, sentences[0]]);
    expect(sayLines(buildScript(plan, 2))).toEqual([...groups, sentences[0]]);
    // Pace III's two groups are the two sentences: the final reading adds no new line.
    expect(sayLines(buildScript(plan, 3))).toEqual(sentences);
  });
  it('says a sentence repeated in the text once in the list: the same line, from the same clip', () => {
    const p = buildPlan('Il pleut. Le loup attend. Il pleut.');
    const lines = sayLines(buildScript(p, 2)).map((l) => l.spoken);
    expect(lines).toEqual([spokenForm('Il pleut.'), spokenForm('Le loup attend.')]);
  });
});

describe("the voice's limit (Kokoro plan Ruling K1, a guard since Ruling R-A1)", () => {
  it("fits every seed text's longest line at every pace: a sentence", () => {
    expect(MAX_LINE_CHARS).toBe(10_000); // tts/app/text.py MAX_CHARS
    for (const f of readdirSync('../content/seed').filter((n) => n.endsWith('.json'))) {
      const body = (JSON.parse(readFileSync(`../content/seed/${f}`, 'utf-8')) as { body: string }).body;
      const plan = buildPlan(body);
      const longest = Math.max(...([1, 2, 3] as const).flatMap((pace) => sayLines(buildScript(plan, pace)).map((l) => l.spoken.length)));
      const sentence = Math.max(...plan.sentences.map((s) => spokenForm(s.text, { newParagraph: s.newParagraph }).length));
      expect(longest, f).toBe(sentence);
      expect(longest, f).toBeLessThanOrEqual(MAX_LINE_CHARS);
    }
  });
});
