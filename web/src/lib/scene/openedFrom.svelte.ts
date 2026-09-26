// Where an overlay was opened from (final review M2): the one way every place records it, so a
// seal that steps back can give focus to what opened the overlay (the dossier's sheet, the codex's
// card, the hero panel's medallion, the portal's work card) rather than to the place's hotspot.
// Only a move INTO a tracked overlay records where it came from, so an overlay that is leaving
// keeps its target during its fade.
import { untrack } from 'svelte';
import type { PanelId } from '../world/places';

export type OpenedFromMap = Partial<Record<PanelId, PanelId | null>>;

/** One step of the record (pure, for the unit tests): the move from `prev` to `next`. `keepFrom`
 *  lists, per overlay, the overlays a move back from must not overwrite its origin (a portrait
 *  closing onto the codex page it was opened from leaves the page's own origin, the codex). */
export function recordOpening(
  map: OpenedFromMap,
  prev: PanelId | null,
  next: PanelId | null,
  targets: readonly PanelId[],
  keepFrom: Partial<Record<PanelId, readonly PanelId[]>> = {},
): OpenedFromMap {
  if (next === prev || next === null || !targets.includes(next)) return map;
  if (prev !== null && keepFrom[next]?.includes(prev)) return map;
  return { ...map, [next]: prev };
}

/** Tracks `panel()` from the component that calls it (during its initialisation, like any rune).
 *  The panel it mounts with counts as opened from nowhere (a deep link, a reload). */
export function openedFrom(
  panel: () => PanelId | null,
  targets: readonly PanelId[],
  keepFrom: Partial<Record<PanelId, readonly PanelId[]>> = {},
): { of(p: PanelId): PanelId | null } {
  let map = $state<OpenedFromMap>({});
  let last = untrack(panel);
  $effect(() => {
    const next = panel();
    const prev = last;
    last = next;
    map = untrack(() => recordOpening(map, prev, next, targets, keepFrom));
  });
  return { of: (p) => map[p] ?? null };
}
