// The stall's pieces the dragon has already pointed out (SP4 final review I1, ruling a):
// `settings.shop_seen` on the server, plus what this page load has said. The camp's what-next line
// names Hermès's stall only for an affordable piece not in it (nextStep.ts `newlyAffordable`), so a
// purse holding 50 drachmes does not hear « Hermès a quelque chose pour toi » at every visit: Hermès
// never pushes (spec 2026-09-29 drachmes). Server-side, not localStorage: it follows the hero across
// devices, as `dragon_seen_stage` does (dragonSeen.svelte.ts).
import { SvelteMap } from 'svelte/reactivity';
import { api } from '../api';
import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

// Per hero: the pieces this page load has named (kept when a save fails).
const seenNow = new SvelteMap<number, string[]>();

/** The pieces this hero has heard the dragon name: the saved ones and this page load's. */
export function shopSeenFor(profile: Profile): string[] {
  const saved = profileStore.current?.id === profile.id ? profileStore.current.settings.shop_seen : profile.settings.shop_seen;
  return [...new Set([...ids(saved), ...(seenNow.get(profile.id) ?? [])])];
}

/** The dragon named the stall for `affordable`: remembered at once, then saved with the pieces named
 *  before (a comfort feature: a failed save only means the line may come back on another page load). */
export async function markShopSeen(profile: Profile, affordable: readonly string[]): Promise<void> {
  const all = [...new Set([...shopSeenFor(profile), ...affordable])];
  seenNow.set(profile.id, all);
  try {
    const updated = await api.profiles.patch(profile.id, { settings: { shop_seen: all } });
    if (profileStore.current?.id === profile.id) profileStore.current = updated;
  } catch {
    // Named for this page load whatever the server said.
  }
}

export function resetShopSeenForTests(): void {
  seenNow.clear();
}
