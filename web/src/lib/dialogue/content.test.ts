// UI5 (spec §8, §1): the content files are the whole dialogue of the camp. Every line passes the
// camp's copy rules here, since the file guards (registerGuard, noGuilt) scan src/ only.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { FORBIDDEN, lieutenantName } from '../world/eris';
import { SCENES } from '../world/scenes';
import { DRAGON_STAGES, LIEUTENANT_ORDER } from '../world/types';
import { GENDERED, GUILT, banned, erisSelfMasculine } from '../../testing/copyRules';
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
const STAGES = DRAGON_STAGES.map((stage) => ({ stage }) as DialogueCtx);
const DOMAINS: Partial<Record<DialogueKey, DialogueCtx[]>> = {
  // UI5 playability #13: the camp's greeting grows with the dragon (without camp data: the generic).
  'camp.enter': [{}, ...STAGES],
  'nest.enter': STAGES,
  // Spec 2026-09-29 explanations §1: the what-next lines, in every context the camp asks them.
  'camp.next.name': DRAGON_STAGES.filter((s) => s !== 'egg').map((stage) => ({ stage }) as DialogueCtx),
  'camp.next.stage': DRAGON_STAGES.filter((s) => s !== 'ancestral').map((stage) => ({ stage }) as DialogueCtx),
  'camp.next.seal': LIEUTENANT_ORDER.map((opponent) => ({ opponent }) as DialogueCtx),
  'battle.start': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  // UI5 playability #21: a retry names the lieutenant on the field (Éris herself: the generic lines).
  'battle.retry': ['eris', ...LIEUTENANT_ORDER].flatMap((opponent) => (['dictation', 'grimoire'] as const).map((mode) => ({ opponent, mode }) as DialogueCtx)),
  // Final review M9: a grimoire that Éris failed to corrupt (no dés-accord took) ends « perfect » too.
  'battle.perfect': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.victory': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.retreat': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.caught': [{ mode: 'dictation' }, { mode: 'grimoire' }],
  'battle.missed': [{ mode: 'dictation' }, { mode: 'grimoire' }],
};

describe('the dialogue content (spec §8)', () => {
  it('has exactly the files and keys the code asks for, each key in its own file', () => {
    expect(readdirSync(DIR).sort()).toEqual(['battle.json', 'cabin.json', 'camp.json', 'delphi.json', 'library.json', 'nest.json', 'stall.json', 'war.json']);
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
      const ringable = [...scene.hotspots.map((h) => h.id), ...Object.keys(scene.tourAreas ?? {})];
      for (const step of TOURS[id]) if (step.target) expect(ringable, `${id}: ${step.target}`).toContain(step.target);
      for (const stage of DRAGON_STAGES) {
        expect(TOURS[id].filter((s) => !s.when || s.when.stage?.includes(stage)).length, `${id} ${stage}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('names only the six dragon stages in a when.stage (a typo would never speak, silently)', () => {
    const file = (stage: string[]) => ({ lines: { 'nest.enter': [{ speaker: 'dragon', when: { stage }, text: 'Un mot.' }] } });
    expect(() => parseDialogueFile('nest.json', file(['illustré']))).toThrow(/when\.stage/);
    expect(() => parseDialogueFile('nest.json', file(['illustre', 'ancestral']))).not.toThrow();
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

  // Spec 2026-09-29 drachmes §2: Hermès never pushes: no price, no delay, no scarcity in his mouth.
  it('lets Hermès welcome and thank, never press', () => {
    const lines = every.filter((x) => x.line.speaker === 'hermes');
    expect(lines.length).toBeGreaterThanOrEqual(12);
    for (const { where, line } of lines) {
      expect(line.text, where).not.toMatch(/\d|drachme|prix|promo|remise|réduc|solde|vite|dernière|dernier|plus que|seulement|aujourd'hui|demain|bientôt|avant que|stock|rare/i);
    }
  });

  it('lets Éris agree with herself in the feminine (UI5 playability #3)', () => {
    for (const { where, line } of every.filter((x) => x.line.speaker === 'eris')) expect(erisSelfMasculine(line.text), where).toEqual([]);
  });

  it("names the lieutenant on the field when Éris sees a text again (UI5 playability #21)", () => {
    for (const k of LIEUTENANT_ORDER) {
      const name = lieutenantName(k).replace(/^(L'|La |Les )/, '');
      for (const l of poolFor(LINES['battle.retry'], { opponent: k })) expect(l.text, k).toContain(name);
    }
  });

  it("keeps the owl's « Hou » to about a third of its lines (UI5 playability #11)", () => {
    const owl = every.filter((x) => x.line.speaker === 'owl');
    expect(owl.filter((x) => /(^|[.!?] )Hou\b/.test(x.line.text)).length).toBeLessThanOrEqual(Math.ceil(owl.length / 3));
  });

  it('is authored with plain spaces, typographic signs and a length that fits the box', () => {
    for (const { where, line } of every) {
      expect(line.text, where).not.toMatch(/[\u00a0\u202f]/);
      expect(line.text, where).not.toMatch(/ {2}|^\s|\s$|"|\.\.\./);
      expect(line.text.length, where).toBeLessThanOrEqual(170);
    }
  });

  it('is never spoken by the dictation voice', () => {
    for (const f of ['src/lib/dialogue/select.ts', 'src/lib/dialogue/battle.ts', 'src/lib/tours/tours.ts', 'src/components/scene/DialogueBox.svelte', 'src/components/scene/OverlayVoice.svelte', 'src/components/scene/TourLayer.svelte']) {
      expect(readFileSync(f, 'utf-8'), f).not.toMatch(/dictation\/(tts|voice)|speechSynthesis|speak\(/);
    }
  });
});
