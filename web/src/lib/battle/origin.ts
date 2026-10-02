// Where a battle was opened from (the user's report 2026-10-02): « Oui, quitter » leaves the battle
// for that place (the shelves, the quest wall, a lieutenant's sheet, Éris's lair...), not for a
// ribbon on the same screen. Play is opened from many links (plain anchors among them), so the
// router notes it rather than each link: when a battle's history entry is entered, its state is
// stamped with the hash it came from. The stamp lives on the entry itself, so a reload keeps it, and
// Back into a battle (after its HUD's hero panel, say) finds it unchanged. A deep link has none: the
// camp, home, takes it.
import { href, matchRoute, type Route } from '../routes';

export const ORIGIN_KEY = 'discordeBattleFrom';

/** The part of `window.history` this module uses (injectable for the unit tests). */
export interface OriginHistory {
  readonly state: unknown;
  replaceState(data: unknown, unused: string): void;
}

const isBattle = (name: string): boolean => name === 'play' || name === 'grimoire';

/** The origin stamped on a history entry's state, if any. */
export function battleOriginOf(state: unknown): string | null {
  if (state === null || typeof state !== 'object') return null;
  const from = (state as Record<string, unknown>)[ORIGIN_KEY];
  return typeof from === 'string' && from !== '' ? from : null;
}

// The last origin noted: a battle entered from another battle (the muster's grimoire link, the
// victory's « Revoir » entry) carries it on.
let current: string | null = null;

/** Called by the router on every hashchange, `prevHash` being the hash it leaves. */
export function noteBattleOrigin(prevHash: string, route: Route, h: OriginHistory): void {
  if (!isBattle(route.name)) return;
  const stamped = battleOriginOf(h.state);
  if (stamped) {
    current = stamped;
    return;
  }
  current = prevHash && isBattle(matchRoute(prevHash).name) ? current : prevHash || null;
  if (!current) return;
  const base = h.state !== null && typeof h.state === 'object' ? (h.state as Record<string, unknown>) : {};
  h.replaceState({ ...base, [ORIGIN_KEY]: current }, '');
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
