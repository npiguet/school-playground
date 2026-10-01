// Loads and checks the dialogue files at import (a bad file fails the build's tests, never a player's
// screen): every key belongs to DIALOGUE_KEYS and to its own file, every speaker exists, every
// `when` names known conditions. The files are imported one by one (typed, bundled by Vite).
import camp from '@content/dialogue/camp.json';
import library from '@content/dialogue/library.json';
import delphi from '@content/dialogue/delphi.json';
import war from '@content/dialogue/war.json';
import nest from '@content/dialogue/nest.json';
import cabin from '@content/dialogue/cabin.json';
import battle from '@content/dialogue/battle.json';
import stall from '@content/dialogue/stall.json';
import { DRAGON_STAGES } from '../world/types';
import { DIALOGUE_KEYS, TOUR_IDS, type DialogueFile, type DialogueKey, type LineDef, type TourId, type TourStepDef } from './types';

const SPEAKERS = new Set(['dragon', 'pythia', 'owl', 'eris', 'hermes']);
const WHEN_KEYS = new Set(['stage', 'opponent', 'mode']);

function checkLine(where: string, x: unknown, tour: boolean): LineDef | TourStepDef {
  const o = x as Record<string, unknown>;
  if (typeof o !== 'object' || o === null) throw new Error(`${where}: not an object`);
  if (!SPEAKERS.has(o.speaker as string)) throw new Error(`${where}: unknown speaker ${String(o.speaker)}`);
  if (typeof o.text !== 'string' || !o.text.trim()) throw new Error(`${where}: empty text`);
  if (o.when !== undefined) {
    const w = o.when as Record<string, unknown>;
    for (const [k, v] of Object.entries(w)) {
      if (!WHEN_KEYS.has(k) || !Array.isArray(v) || v.length === 0) throw new Error(`${where}: bad when.${k}`);
      if (k === 'stage' && (v as unknown[]).some((s) => !(DRAGON_STAGES as readonly unknown[]).includes(s))) {
        throw new Error(`${where}: bad when.stage ${JSON.stringify(v)}`);
      }
    }
  }
  if (tour && !(o.target === null || typeof o.target === 'string')) throw new Error(`${where}: bad target`);
  return o as unknown as LineDef;
}

export function parseDialogueFile(name: string, raw: unknown): DialogueFile {
  const area = name.replace(/\.json$/, '');
  const r = raw as { lines?: unknown; tour?: unknown };
  if (typeof r?.lines !== 'object' || r.lines === null) throw new Error(`${name}: no lines`);
  const lines: Record<string, LineDef[]> = {};
  for (const [key, list] of Object.entries(r.lines as Record<string, unknown>)) {
    if (!key.startsWith(`${area}.`)) throw new Error(`${name}: ${key} belongs elsewhere`);
    if (!(DIALOGUE_KEYS as readonly string[]).includes(key)) throw new Error(`${name}: unknown key ${key}`);
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${name}: ${key} is empty`);
    lines[key] = list.map((x, i) => checkLine(`${name} ${key}[${i}]`, x, false));
  }
  const tour = r.tour === undefined ? undefined : (r.tour as unknown[]).map((x, i) => checkLine(`${name} tour[${i}]`, x, true) as TourStepDef);
  return { lines, ...(tour ? { tour } : {}) };
}

const FILES = { camp, library, delphi, war, nest, cabin, stall, battle } as Record<string, unknown>;
const parsed = Object.entries(FILES).map(([n, raw]) => [n, parseDialogueFile(`${n}.json`, raw)] as const);

export const LINES = Object.fromEntries(parsed.flatMap(([, f]) => Object.entries(f.lines))) as Record<DialogueKey, LineDef[]>;
export const TOURS = Object.fromEntries(
  parsed.filter(([n, f]) => f.tour && (TOUR_IDS as readonly string[]).includes(n)).map(([n, f]) => [n, f.tour!]),
) as Record<TourId, TourStepDef[]>;
