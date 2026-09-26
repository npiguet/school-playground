// UI5 (spec §8, §1): the content files are the whole dialogue of the camp. Every line passes the
// camp's copy rules here, since the file guards (registerGuard, noGuilt) scan src/ only.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { FORBIDDEN } from '../world/eris';
import { SCENES } from '../world/scenes';
import { GENDERED, GUILT, banned } from '../../testing/copyRules';
import { LINES, TOURS, parseDialogueFile } from './content';
import { DIALOGUE_KEYS, PLACEHOLDERS, TOUR_IDS, type DialogueCtx, type DialogueKey, type LineDef } from './types';
import { poolFor } from './select';

const DIR = '../content/dialogue';
const every: { where: string; line: LineDef }[] = [
  ...Object.entries(LINES).flatMap(([k, ls]) => ls.map((line) => ({ where: k, line }))),
  ...Object.entries(TOURS).flatMap(([t, ls]) => ls.map((line, i) => ({ where: `tour.${t}.${i}`, line }))),
];

// The contexts each key is asked in (default: none): every one must have at least three lines to
// pick from, so « no immediate repeat » always has somewhere to go.
const DOMAINS: Partial<Record<DialogueKey, DialogueCtx[]>> = {
  'nest.enter': ['egg', 'hatchling', 'young', 'adult'].map((stage) => ({ stage }) as DialogueCtx),
  'battle.start': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.victory': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.retreat': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.caught': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.missed': [{ mode: 'dictation' }, { mode: 'grimoire' }],
};

describe('the dialogue content (spec §8)', () => {
  it('has exactly the files and keys the code asks for, each key in its own file', () => {
    expect(readdirSync(DIR).sort()).toEqual(['battle.json', 'cabin.json', 'camp.json', 'delphi.json', 'library.json', 'nest.json', 'war.json']);
    expect(Object.keys(LINES).sort()).toEqual([...DIALOGUE_KEYS].sort());
    for (const f of readdirSync(DIR)) {
      const file = parseDialogueFile(f, JSON.parse(readFileSync(`${DIR}/${f}`, 'utf-8')));
      for (const k of Object.keys(file.lines)) expect(k.startsWith(`${f.replace('.json', '')}.`), `${f}: ${k}`).toBe(true);
    }
  });

  it('offers at least three lines for every key in every context it is asked in', () => {
    for (const k of DIALOGUE_KEYS) {
      for (const ctx of DOMAINS[k] ?? [{}]) expect(poolFor(LINES[k], ctx).length, `${k} ${JSON.stringify(ctx)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('walks each tour through hotspots that exist in its place, for every dragon stage', () => {
    expect(Object.keys(TOURS).sort()).toEqual([...TOUR_IDS].sort());
    for (const id of TOUR_IDS) {
      const scene = SCENES.find((s) => s.id === id)!;
      for (const step of TOURS[id]) if (step.target) expect(scene.hotspots.map((h) => h.id), `${id}: ${step.target}`).toContain(step.target);
      for (const stage of ['egg', 'hatchling', 'young', 'adult'] as const) {
        expect(TOURS[id].filter((s) => !s.when || s.when.stage?.includes(stage)).length, `${id} ${stage}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('uses only the placeholders each key declares', () => {
    for (const { where, line } of every) {
      const used = [...line.text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const allowed = PLACEHOLDERS[where as DialogueKey] ?? [];
      for (const u of used) expect(allowed, `${where}: {${u}}`).toContain(u);
    }
  });

  it('speaks the camp, never the school, never guilt, never an agreement with the player', () => {
    for (const { where, line } of every) {
      expect(banned(line.text), where).toEqual([]);
      expect(line.text.match(GUILT), where).toBeNull();
      expect(line.text.match(GENDERED), where).toBeNull();
    }
  });

  it("keeps Éris's taunts on her tricks and the camp's heroes, never the player's ability", () => {
    for (const { where, line } of every.filter((x) => x.line.speaker === 'eris')) {
      for (const w of FORBIDDEN) expect(line.text.toLowerCase().includes(w), `${where}: « ${w} »`).toBe(false);
    }
  });

  it('is authored with plain spaces, typographic signs and a length that fits the box', () => {
    for (const { where, line } of every) {
      expect(line.text, where).not.toMatch(/[\u00a0\u202f]/);
      expect(line.text, where).not.toMatch(/ {2}|^\s|\s$|"|\.\.\./);
      expect(line.text.length, where).toBeLessThanOrEqual(170);
    }
  });

  it('is never spoken by the dictation voice', () => {
    for (const f of ['src/lib/dialogue/select.ts', 'src/lib/dialogue/battle.ts', 'src/lib/tours/tours.ts', 'src/components/scene/DialogueBox.svelte', 'src/components/scene/OverlayVoice.svelte']) {
      expect(readFileSync(f, 'utf-8'), f).not.toMatch(/dictation\/tts|speechSynthesis|speak\(/);
    }
  });
});
