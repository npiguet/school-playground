// Picks what a character says (spec §8, Ruling E11): among a key's lines, those made for this context
// (a `when` that matches) beat the generic ones; the one said last for that key is never said again
// right away (per page load, like the greetings, Ruling A9), unless it is the only one.
import { frenchSpacing } from '../text/french';
import type { DragonLook } from '../world/scenes/speakers';
import type { DialogueLine } from '../scene/types';
import { LINES } from './content';
import { frameFor } from './speakers';
import type { DialogueCtx, DialogueKey, LineDef, When } from './types';

const lastSaid = new Map<string, string>();

export function matches(w: When | undefined, c: DialogueCtx): boolean {
  if (!w) return true;
  return (
    (!w.stage || (c.stage !== undefined && w.stage.includes(c.stage))) &&
    (!w.opponent || (c.opponent !== undefined && w.opponent.includes(c.opponent))) &&
    (!w.mode || (c.mode !== undefined && w.mode.includes(c.mode)))
  );
}

export function poolFor(lines: LineDef[], ctx: DialogueCtx): LineDef[] {
  const specific = lines.filter((l) => l.when && matches(l.when, ctx));
  return specific.length > 0 ? specific : lines.filter((l) => !l.when);
}

export function pick(pool: LineDef[], last: string | undefined, rnd: () => number): LineDef | null {
  if (pool.length === 0) return null;
  // Every variant equal to the last one (a duplicated line): any of them will do.
  const others = pool.filter((l) => l.text !== last);
  const fresh = others.length > 0 ? others : pool;
  return fresh[Math.min(fresh.length - 1, Math.floor(rnd() * fresh.length))];
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export interface SayOpts {
  ctx?: DialogueCtx;
  vars?: Record<string, string>;
  dragon?: DragonLook | null;
  rnd?: () => number;
}

/** A line of `key`, framed for its speaker, spaced, tagged with its key (`data-key` in the DOM). The
 *  content test guarantees every key has lines for every context it is asked in; a miss is a bug
 *  and throws. */
export function sayKey(key: DialogueKey, o: SayOpts = {}): DialogueLine {
  const ctx = { ...(o.dragon ? { stage: o.dragon.stage } : {}), ...o.ctx };
  const line = pick(poolFor(LINES[key] ?? [], ctx), lastSaid.get(key), o.rnd ?? Math.random);
  if (!line) throw new Error(`no line for ${key}`);
  lastSaid.set(key, line.text);
  return { ...frameFor(line.speaker, o.dragon), text: frenchSpacing(fill(line.text, o.vars ?? {})), key };
}

export function resetDialogueMemory(): void {
  lastSaid.clear();
}
