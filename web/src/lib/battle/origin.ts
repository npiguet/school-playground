// Where a battle was opened from (the user's report 2026-10-02): « Oui, quitter » leaves the battle
// for that place (the shelves, the quest wall, a lieutenant's sheet, Éris's lair...), not for a
// ribbon on the same screen, and leaves no way Back into the battle (review I1).
//
// Play is opened from many links (plain anchors among them), so the router notes it rather than
// each link: every battle history entry is stamped once, when it is created, with the hash it came
// from (none for a deep link: the app's first entry, `stampFirstEntry`) and whether that is
// *direct* - the entry before it is that very place. A stamp is never rewritten (review I2): a
// reload keeps it (it lives on the entry), and Back into a battle (after its HUD's hero panel, say)
// finds it unchanged.
//
// Quitting then steps back when the stamp is direct, landing on the place's own entry as it was (its
// overlay tag included); otherwise it replaces the battle's entry with the place (or the camp).
import { href, matchRoute, type Route } from '../routes';
import { PANEL_TAG } from '../scene/panelNav';

export const ORIGIN_KEY = 'discordeBattleFrom';
export const DIRECT_KEY = 'discordeBattleDirect';

/** The part of `window.history` this module uses (injectable for the unit tests). */
export interface OriginHistory {
  readonly state: unknown;
  replaceState(data: unknown, unused: string): void;
}

export interface BattleOrigin {
  /** The hash the battle was opened from; null for none (a deep link). */
  from: string | null;
  /** The history entry right before the battle's is `from`'s. */
  direct: boolean;
}

const isBattle = (name: string): boolean => name === 'play' || name === 'grimoire';

const record = (state: unknown): Record<string, unknown> | null =>
  state !== null && typeof state === 'object' ? (state as Record<string, unknown>) : null;

/** The stamp of a history entry's state, or null when it has none. */
export function battleOriginOf(state: unknown): BattleOrigin | null {
  const s = record(state);
  if (!s || !(ORIGIN_KEY in s)) return null;
  const from = s[ORIGIN_KEY];
  return { from: typeof from === 'string' && from !== '' ? from : null, direct: s[DIRECT_KEY] === true };
}

// The origin of the battle entry last seen: a battle entered from another battle (the muster's
// grimoire link, the victory's « Revoir » entry) carries it on.
let current: string | null = null;

function stamp(h: OriginHistory, origin: BattleOrigin): void {
  current = origin.from;
  h.replaceState({ ...(record(h.state) ?? {}), [ORIGIN_KEY]: origin.from ?? '', [DIRECT_KEY]: origin.direct }, '');
}

/** Called by the router on every hashchange, `prevHash` being the hash it leaves. */
export function noteBattleOrigin(prevHash: string, route: Route, h: OriginHistory): void {
  if (!isBattle(route.name)) return;
  const known = battleOriginOf(h.state);
  if (known) {
    current = known.from;
    return;
  }
  if (prevHash && isBattle(matchRoute(prevHash).name)) stamp(h, { from: current, direct: false });
  else stamp(h, { from: prevHash || null, direct: !!prevHash });
}

/** Called once by the router for the app's first entry: a battle opened there (a deep link, a
 *  bookmark) has no origin, unless a reload finds its own stamp. */
export function stampFirstEntry(hash: string, h: OriginHistory): void {
  if (!isBattle(matchRoute(hash).name)) return;
  const known = battleOriginOf(h.state);
  if (known) current = known.from;
  else stamp(h, { from: null, direct: false });
}

/** Where quitting this hero's battle leads: the place it was opened from; the camp when it has none
 *  (a deep link), or when that is no place of this hero's (a battle, the title screens). */
export function quitTarget(origin: string | null, profileId: number): string {
  const camp = href('camp', { profileId: String(profileId) });
  if (!origin) return camp;
  const route = matchRoute(origin);
  if (isBattle(route.name) || route.params.profileId !== String(profileId)) return camp;
  return origin.startsWith('#') ? origin : '#' + origin;
}

export type QuitPlan = { kind: 'back' } | { kind: 'replace'; to: string };

/** How a quit leaves the battle whose entry holds `state`: for `to` when given (Éris's « Retour au
 *  camp »), else for its origin. Back when the entry before is that very place, else in place. */
export function quitPlan(state: unknown, profileId: number, to?: string): QuitPlan {
  const origin = battleOriginOf(state);
  const target = to ?? quitTarget(origin?.from ?? null, profileId);
  if (origin?.direct && origin.from === target) return { kind: 'back' };
  return { kind: 'replace', to: target };
}

/** The entry a quit replaced is a place now: no stamp, no overlay tag (WebKit keeps a replaced
 *  entry's state, Task S; the place is a fresh entry, not an overlay opened from another). */
export function clearBattleStamp(h: OriginHistory): void {
  const s = record(h.state);
  if (!s) return;
  const { [ORIGIN_KEY]: _from, [DIRECT_KEY]: _direct, [PANEL_TAG]: _tag, ...rest } = s;
  h.replaceState(rest, '');
}
