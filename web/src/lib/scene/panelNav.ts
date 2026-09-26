// Opening and closing routed overlays (UI3 Ruling A2, generalising UI1's hero-panel tag). An
// overlay opened from inside the app pushes its route and tags that history entry, so closing it
// steps back to the entry it came from (Back from the scene then leaves the scene instead of
// reopening the overlay). A deep link or a reload has no entry behind it: closing replaces the
// overlay's own entry with the bare scene.
import { href } from '../routes';
import { navigate, navigationPending, replaceRoute } from '../router.svelte';
import { playSfx, unlockAudio } from '../juice/sfx';
import type { HotspotDef } from './types';

export const PANEL_TAG = 'discordePanel';

/** The part of `window.history` these helpers use (injectable for the unit tests). */
export interface HistoryLike {
  readonly state: unknown;
  back(): void;
  replaceState(data: unknown, unused: string): void;
}

export function tagged(state: unknown): Record<string, unknown> {
  const base = state !== null && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  return { ...base, [PANEL_TAG]: true };
}

export function isTagged(state: unknown): boolean {
  return state !== null && typeof state === 'object' && (state as Record<string, unknown>)[PANEL_TAG] === true;
}

export function openPanel(path: string, h: HistoryLike = history): void {
  navigate(path);
  h.replaceState(tagged(h.state), '');
}

// True from closePanel's own `history.back()` until that traversal has landed. `back()` is
// asynchronous: until then the URL and the entry's tag are still the overlay's, so
// `navigationPending()` cannot see it (Task S).
let steppingBack = false;

function stepBack(h: HistoryLike): void {
  steppingBack = true;
  // The traversal ends on a hashchange; popstate (fired just before it) also covers one that lands
  // on the same hash, so the flag can never stay set and swallow every later close.
  const landed = () => {
    steppingBack = false;
    window.removeEventListener('hashchange', landed);
    window.removeEventListener('popstate', landed);
  };
  window.addEventListener('hashchange', landed);
  window.addEventListener('popstate', landed);
  h.back();
}

export function closePanel(scenePath: string, h: HistoryLike = history): void {
  // A close (seal, Escape, Back button) pressed while a navigation is already under way belongs to
  // a screen that is leaving: acting on it would undo that navigation - e.g. an Escape right after
  // « Rejoindre le camp » stepped back from the camp to the title (fix wave A, found by the crash
  // count runs: HeroForm had already replaced the route, its hashchange not yet handled). The same
  // goes for a second close while this module's own Back is still traversing (a held Escape, or
  // the seal then Escape): it would step back twice, out of the place.
  if (steppingBack || navigationPending()) return;
  if (isTagged(h.state)) stepBack(h);
  else replaceRoute(scenePath);
}

/** Swaps the current overlay for another one in place (a saved form lands on the shelves: Back
 *  must not reopen the empty form, Ruling A2). `location.replace` writes a fresh entry whose state
 *  is null, so an entry that was tagged (opened in the app) is tagged again - otherwise closing
 *  the new overlay would replace instead of stepping back and leave a duplicate scene entry, a
 *  dead Back press (final review I1). A fragment-only `location.replace` updates the entry
 *  synchronously, which is what `openPanel` already relies on for `navigate`. */
export function replacePanel(path: string, h: HistoryLike = history): void {
  const wasTagged = isTagged(h.state);
  replaceRoute(path);
  if (wasTagged) h.replaceState(tagged(h.state), '');
}

/** Leaves an overlay for another screen in place of its entry (the hero form hands off to the
 *  camp: Back from the camp must not reopen the emptied form, Ruling A2). The new screen is not an
 *  overlay, so its entry must not carry the panel tag: Chromium resets `history.state` on a fragment
 *  `location.replace`, but WebKit keeps it, tag included (Task S). */
export function leavePanel(path: string, h: HistoryLike = history): void {
  replaceRoute(path);
  if (!isTagged(h.state)) return;
  const { [PANEL_TAG]: _tag, ...rest } = h.state as Record<string, unknown>;
  h.replaceState(rest, '');
}

export type GoMode = 'push' | 'panel' | 'replace';

/** Every control that navigates goes through here (final review M5): the same tap feedback
 *  (unlocks the audio on the first gesture, plays `tap`) whatever it leads to. `push` leaves the
 *  place (a new screen), `panel` opens an overlay of this place (`openPanel`), `replace` swaps
 *  the current overlay for another (`replacePanel`). */
export function go(path: string, mode: GoMode = 'push', h: HistoryLike = history): void {
  unlockAudio();
  playSfx('tap');
  if (mode === 'panel') openPanel(path, h);
  else if (mode === 'replace') replacePanel(path, h);
  else navigate(path);
}

/** Where the HUD's hero chip leads: the hero panel in the cabin (UI3 Ruling B2, carry #4). */
export function heroPanelHref(profileId: number): string {
  return href('cabin', { profileId: String(profileId) }, { panel: 'heros' });
}

/** The route a hotspot opens, or null when the scene handles the tap itself. */
export function hotspotHref(def: HotspotDef, profileId: number): string | null {
  if (!def.target) return null;
  // profileId is spread last so it always wins over a stray same-named key in def.params.
  return href(def.target, { ...(def.params ?? {}), profileId: String(profileId) }, def.query);
}

/** Opens a hotspot's target as this place's next panel (UI3a Task 9, carried into every place
 *  screen but the camp): `placeFor` keeps the same `place` for these targets, only the `panel`
 *  changes, so there is no scene to leave and no fade to play - just the tap's sound and the
 *  tagged push (Ruling A2), same as PlaceScene's `openHero`. Does nothing for a hotspot the
 *  scene screen handles itself (`target: null`). */
export function openHotspot(def: HotspotDef, profileId: number, h: HistoryLike = history): void {
  const to = hotspotHref(def, profileId);
  if (!to) return;
  go(to, 'panel', h);
}
