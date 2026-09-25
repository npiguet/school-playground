// Opening and closing routed overlays (UI3 Ruling A2, generalising UI1's hero-panel tag). An
// overlay opened from inside the app pushes its route and tags that history entry, so closing it
// steps back to the entry it came from (Back from the scene then leaves the scene instead of
// reopening the overlay). A deep link or a reload has no entry behind it: closing replaces the
// overlay's own entry with the bare scene.
import { href } from '../routes';
import { navigate, replaceRoute } from '../router.svelte';
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

export function closePanel(scenePath: string, h: HistoryLike = history): void {
  if (isTagged(h.state)) h.back();
  else replaceRoute(scenePath);
}

/** Where the HUD's hero chip leads (UI3b Task 6 moves the hero panel into the cabin). */
export function heroPanelHref(profileId: number): string {
  return href('camp', { profileId: String(profileId) }, { panel: 'heros' });
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
 *  tagged push (Ruling A2), same as Camp.svelte's own `openHero`. Does nothing for a hotspot the
 *  scene screen handles itself (`target: null`). */
export function openHotspot(def: HotspotDef, profileId: number): void {
  const to = hotspotHref(def, profileId);
  if (!to) return;
  unlockAudio();
  playSfx('tap');
  openPanel(to);
}
