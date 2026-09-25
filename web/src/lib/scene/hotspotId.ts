// A hotspot's test id is `<sceneId>-<hotspot id>` (UI1 Ruling 4). Hotspot.svelte writes it and the
// place screens point an overlay's `returnFocus` at it, so the convention lives here once (final
// review M18) instead of being spelled out by hand in each screen.
export function hotspotTestId(sceneId: string, id: string): string {
  return `${sceneId}-${id}`;
}

/** The CSS selector of a hotspot's button, e.g. for an overlay's `returnFocus`. */
export function hotspotSelector(sceneId: string, id: string): string {
  return `[data-testid="${hotspotTestId(sceneId, id)}"]`;
}
