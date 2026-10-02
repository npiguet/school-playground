// The camp hub's data store: one shared `$state` so the HUD, the camp scene and the victory can
// all read the latest dragon/xp/weekly snapshot without re-fetching. `refreshCamp` is tolerant of
// the world API not existing yet (SP3 server Tasks 2-3 land separately) - a 404/network failure
// just surfaces a friendly French message, never a crash.
import { ApiError } from '../api';
import { worldApi } from './api';
import type { CampResponse, WorldCatalog } from './types';

export const campStore = $state<{ data: CampResponse | null; loading: boolean; error: string; catalog: WorldCatalog | null; catalogFailed: boolean }>({
  data: null,
  loading: false,
  error: '',
  catalog: null,
  // The last catalog load failed (SP4 final review M2): a screen that cannot do without it (Hermès's
  // stall) says so and offers « Réessayer » instead of waiting for ever.
  catalogFailed: false,
});

// UI3a Task 9: this store is shared, but its callers are no longer only Camp.svelte - every
// PlaceScene mount (LibraryTent, and Delphi in Task 12) fires the same `refreshCamp` on the same
// profile. A quick camp -> tent -> camp round trip (scenes-camp.spec.ts) can start a second fetch
// before the first one lands; without this token, whichever response arrives last wins, even if it
// was the older, now-superseded one. Bumped on every call, checked before each write: only the
// most recently *started* refresh may ever update the store.
let refreshToken = 0;

// campStore is shared across every profile in the session: a quick hero switch (or a PlaceScene
// mount racing a stale fetch) can leave a snapshot that belongs to a *different* profile sitting
// in `campStore.data`. Every reader (PlaceScene, which every place incl. the camp is built on) needs the
// same "is this snapshot actually this profile's?" guard before trusting it - kept here once
// rather than re-derived at each call site (Task 12 review fix round 1).
export function campFor(profileId: number): CampResponse | null {
  return campStore.data && campStore.data.profile.id === profileId ? campStore.data : null;
}

/** An optimistic local change to this hero's snapshot (the care panel's tint): written only while
 *  the snapshot on show is this hero's, never over another hero's (final review I2). Readers go
 *  through `campFor`; this and `refreshCamp` are the only writers. */
export function replaceCamp(profileId: number, next: CampResponse): void {
  if (campFor(profileId) && next.profile.id === profileId) campStore.data = next;
}

export async function refreshCamp(profileId: number): Promise<void> {
  const token = ++refreshToken;
  campStore.loading = true;
  campStore.error = '';
  try {
    const data = await worldApi.camp(profileId);
    if (token !== refreshToken) return;
    campStore.data = data;
  } catch (e) {
    if (token !== refreshToken) return;
    campStore.error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
  } finally {
    if (token === refreshToken) campStore.loading = false;
  }
}

// Caches the (mostly static) world catalog - technique lines, lieutenant names, reward catalog - so screens
// that need it (Lieutenant, Dossier) don't each fetch it separately. Best-effort: the world API
// may not exist yet (SP3 server Tasks 2-3), so a failure just leaves it `null` and callers fall
// back to their own generic text; `catalogFailed` tells the screens that cannot (the stall) to say so.
export async function loadCatalog(): Promise<void> {
  if (campStore.catalog) return;
  campStore.catalogFailed = false;
  try {
    campStore.catalog = await worldApi.world();
  } catch {
    // Non-critical for most screens: they degrade gracefully without it.
    if (!campStore.catalog) campStore.catalogFailed = true;
  }
}
