// The one next step of the game (UI3a playability recommendation 5, immersion Deferred #11, UI3
// Ruling B9): the hub's glow and each place's glow read it, so the hub and the place never disagree
// on where to go. The dragon's what-next line (spec 2026-09-29 explanations §1, plan R1) is
// `whatNext`: the goals the glow names come first when they are the next step, then the
// progression's goals.
import { LIEUTENANT_ORDER, type CampResponse, type LieutenantKey } from './types';
import { nearNextStage } from './dragon';
import { lieutenantName } from './eris';
import { nearestProphecy, prophecyWhen } from './prophecy';
import { lowerLeadingArticle } from './quests';
import { sealName } from './seals';
import type { DialogueCtx, DialogueKey } from '../dialogue/types';
import { countWord } from '../text/french';

export type NextStep = 'battle' | 'first-text' | 'prophecy' | 'scrolls' | null;

/** A fight against Éris is already under way (her quest is active). */
export const bossEngaged = (camp: CampResponse) => camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');

/** Ruling B9, order amended by the controller: a prophecy falling due within a week first (the
 *  real-school dictation is what the game prepares for), then a battle ready to be fought, then a
 *  new hero's first text, then the week's sealed scrolls. */
export function nextStep(camp: CampResponse | null): NextStep {
  if (!camp) return null;
  const p = nearestProphecy(camp);
  if (p && p.days_left <= 7) return 'prophecy';
  if (camp.boss.tier_available !== null && !bossEngaged(camp)) return 'battle';
  if (camp.xp.total === 0) return 'first-text';
  if (camp.oracle.status === 'sealed') return 'scrolls';
  return null;
}

/** The hub place each step leads to (CAMP_HOTSPOTS ids). */
export const HUB_PLACE = {
  battle: 'boss',
  'first-text': 'parchemins',
  prophecy: 'oracle',
  scrolls: 'oracle',
} as const satisfies Record<Exclude<NextStep, null>, string>;

export type NextCase = 'name' | 'prophecy' | 'battle' | 'first-text' | 'seal' | 'stage' | 'shop' | 'scrolls' | 'weekly' | 'none';

/** The greeting's last line: `camp.next.<case>` in the content (UI5 Ruling E12, spec §1). */
export interface NextLine {
  kind: NextCase;
  key: DialogueKey;
  vars?: Record<string, string>;
  ctx?: DialogueCtx;
}

// A share of whole counts may land a hair under a decimal target (22/25 against 0.88), as on the server.
const EPSILON = 1e-9;

/** Spec §1 case 3 (R3): the lieutenant closest to its next seal whose window is at least 70 % complete
 *  in days and in chances (whole numbers) and whose share is at target; the fuller window first, then
 *  the camp's order. */
export function sealWithinReach(camp: Pick<CampResponse, 'lieutenants'>): { key: LieutenantKey; level: number } | null {
  let best: { key: LieutenantKey; level: number; fill: number; order: number } | null = null;
  for (const l of camp.lieutenants) {
    const n = l.next;
    const order = LIEUTENANT_ORDER.indexOf(l.key as LieutenantKey);
    if (!l.available || !n || order < 0 || n.correct === null) continue;
    if (10 * n.days < 7 * n.need.days || 10 * n.chances < 7 * n.need.chances) continue;
    if (n.correct < n.need.correct - EPSILON) continue;
    const fill = Math.min(1, n.days / n.need.days, n.chances / n.need.chances);
    if (!best || fill > best.fill || (fill === best.fill && order < best.order)) best = { key: l.key as LieutenantKey, level: n.level, fill, order };
  }
  return best ? { key: best.key, level: best.level } : null;
}

/** « un texte », « deux textes » (R6), digits past six. */
const texts = (n: number) => `${countWord(n)} ${n < 2 ? 'texte' : 'textes'}`;

/** The dragon's what-next line (spec §1, R1): a pure function of the camp, first match wins. */
export function whatNext(camp: CampResponse): NextLine {
  const d = camp.dragon;
  if (d.stage !== 'egg' && !d.name) return { kind: 'name', key: 'camp.next.name' };
  const p = nearestProphecy(camp);
  if (p && p.days_left <= 7) return { kind: 'prophecy', key: 'camp.next.prophecy', vars: { when: prophecyWhen(p.days_left) } };
  // Engaged or not: Éris still waits on the path while her fight is under way.
  if (camp.boss.tier_available !== null) return { kind: 'battle', key: 'camp.next.battle' };
  if (camp.xp.total === 0) return { kind: 'first-text', key: 'camp.next.first-text' };
  const near = sealWithinReach(camp);
  if (near) {
    return {
      kind: 'seal',
      key: 'camp.next.seal',
      // « l'Hydre », « les Sirènes »: the camp's name inside a sentence.
      vars: { lieutenant: lowerLeadingArticle(lieutenantName(near.key)), seal: sealName(near.level) },
      ctx: { opponent: near.key },
    };
  }
  if (nearNextStage(camp.xp)) return { kind: 'stage', key: 'camp.next.stage' };
  if (camp.affordable > 0) return { kind: 'shop', key: 'camp.next.shop' };
  if (camp.oracle.status === 'sealed') return { kind: 'scrolls', key: 'camp.next.scrolls' };
  if (!camp.weekly.reached) return { kind: 'weekly', key: 'camp.next.weekly', vars: { texts: texts(Math.max(1, camp.weekly.target - camp.weekly.done)) } };
  return { kind: 'none', key: 'camp.next.none' };
}
