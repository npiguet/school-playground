// The hotspot debug overlay flag (scenes UI spec §4, plan Ruling 9 revised - Task 9b): `?debug`
// before the hash (`/?debug#/p/1/camp`) or in the hash query (`#/p/1/camp?debug`). Shows a
// read-only outline overlay (HotspotDebug.svelte); replaces the interactive `?edit` editor the
// user decided against.
export function isDebugMode(search: string, query: Record<string, string>): boolean {
  return new URLSearchParams(search).has('debug') || Object.prototype.hasOwnProperty.call(query, 'debug');
}
