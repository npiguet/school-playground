// Which tours a hero has seen (Ruling E13): `settings.tours` on the server, plus what this page load
// has shown, so a failed save never replays a tour she just closed. Reactive (SvelteSet), so the
// camp's deep-linked hero panel opens as soon as its tour ends.
import { SvelteSet } from 'svelte/reactivity';
import { api } from '../api';
import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import type { TourId } from '../dialogue/types';
import { seenEntries, tourSeen, toursEnabled } from './tours';

const seenNow = new SvelteSet<string>();
// Tours given up for this page load: the place could not reach /camp (a tour waits for the dragon's
// stage), so it greets instead, and the camp's deep-linked hero panel opens. Not saved: the tour
// comes back on the next visit.
const waived = new SvelteSet<string>();
const k = (profileId: number, id: TourId) => `${profileId}:${id}`;

export function shouldTour(profile: Profile, id: TourId): boolean {
  const key = k(profile.id, id);
  return toursEnabled() && !seenNow.has(key) && !waived.has(key) && !tourSeen(profile.settings, id);
}

export function giveUpTour(profile: Profile, id: TourId): void {
  waived.add(k(profile.id, id));
}

// The server replaces the whole `tours` list on each save, so saves run one after the other (never
// two in flight, where the older could land last), and each one sends every tour this page load
// has seen for the hero, at its current version (R8), on top of the saved ones (a failed save is
// made good by the next).
let saving: Promise<unknown> = Promise.resolve();
function chained<T>(save: () => Promise<T>): Promise<T> {
  const next = saving.then(save);
  saving = next.catch(() => undefined);
  return next;
}

function seenThisLoad(profileId: number): TourId[] {
  const prefix = `${profileId}:`;
  return [...seenNow].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length) as TourId);
}

export function markTourSeen(profile: Profile, id: TourId): Promise<void> {
  seenNow.add(k(profile.id, id));
  return chained(async () => {
    const base = profileStore.current?.id === profile.id ? profileStore.current.settings : profile.settings;
    const tours = [...new Set([...(base.tours ?? []), ...seenThisLoad(profile.id).flatMap(seenEntries)])];
    const settings = tours.includes('camp') ? { tours, onboarded: true } : { tours };
    try {
      const updated = await api.profiles.patch(profile.id, { settings });
      if (profileStore.current?.id === profile.id) profileStore.current = updated;
    } catch {
      // A comfort feature: the tour is closed for this page load whatever the server said.
    }
  });
}

/** « Refaire les visites du camp » (the lyre): errors reach the lyre, which shows them. */
export function resetTours(profileId: number): Promise<void> {
  for (const key of [...seenNow, ...waived]) {
    if (key.startsWith(`${profileId}:`)) {
      seenNow.delete(key);
      waived.delete(key);
    }
  }
  return chained(async () => {
    const updated = await api.profiles.patch(profileId, { settings: { tours: [], onboarded: false } });
    if (profileStore.current?.id === profileId) profileStore.current = updated;
  });
}

export function resetSeenForTests(): void {
  seenNow.clear();
  waived.clear();
  saving = Promise.resolve();
}
