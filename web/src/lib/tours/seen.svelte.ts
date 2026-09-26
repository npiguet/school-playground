// Which tours a hero has seen (Ruling E13): `settings.tours` on the server, plus what this page load
// has shown, so a failed save never replays a tour she just closed. Reactive (SvelteSet), so the
// camp's deep-linked hero panel opens as soon as its tour ends.
import { SvelteSet } from 'svelte/reactivity';
import { api } from '../api';
import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import type { TourId } from '../dialogue/types';
import { tourSeen, toursEnabled } from './tours';

const seenNow = new SvelteSet<string>();
const k = (profileId: number, id: TourId) => `${profileId}:${id}`;

export function shouldTour(profile: Profile, id: TourId): boolean {
  return toursEnabled() && !seenNow.has(k(profile.id, id)) && !tourSeen(profile.settings, id);
}

export async function markTourSeen(profile: Profile, id: TourId): Promise<void> {
  seenNow.add(k(profile.id, id));
  const base = profileStore.current?.id === profile.id ? profileStore.current.settings : profile.settings;
  const tours = [...new Set([...(base.tours ?? []), id])];
  const settings = id === 'camp' ? { tours, onboarded: true } : { tours };
  try {
    const updated = await api.profiles.patch(profile.id, { settings });
    if (profileStore.current?.id === profile.id) profileStore.current = updated;
  } catch {
    // A comfort feature: the tour is closed for this page load whatever the server said.
  }
}

/** « Refaire les visites du camp » (the lyre): errors reach the lyre, which shows them. */
export async function resetTours(profileId: number): Promise<void> {
  for (const key of [...seenNow]) if (key.startsWith(`${profileId}:`)) seenNow.delete(key);
  const updated = await api.profiles.patch(profileId, { settings: { tours: [], onboarded: false } });
  if (profileStore.current?.id === profileId) profileStore.current = updated;
}

export function resetSeenForTests(): void {
  seenNow.clear();
}
