// The dragon's stage the hero last saw (final review I3): `settings.dragon_seen_stage` on the
// server, plus what this page load has shown. A dragon that grew while she was away (a lowered
// threshold, the stages' catch-up on the first /camp after an update, ruling R2) is revealed once at
// the camp: « Ton dragon a grandi pendant ton absence… », and its name asked if it has none. The
// victory that shows a hatch or a new stage records it server-side (the session's progression), so
// the camp never repeats it; it is remembered here too, for a page whose profile reload failed.
// A missing setting means « never shown »: the reveal shows once for the current stage, unless it is
// the egg (nothing to reveal). Server-side, not localStorage: it follows the hero across devices.
import { SvelteMap } from 'svelte/reactivity';
import { api } from '../api';
import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import { stageLabel } from './dragon';
import { DRAGON_STAGES, type DragonOut, type DragonStage } from './types';

export interface CampReveal {
  stage: DragonStage;
  line: string;
  askName: boolean;
}

const rank = (s: unknown): number => (typeof s === 'string' ? (DRAGON_STAGES as readonly string[]).indexOf(s) : -1);

/** What the camp reveals of a dragon last seen at `seen` (any saved value: a stage, nothing, junk),
 *  or null. Pure. */
export function campReveal(dragon: Pick<DragonOut, 'stage' | 'name'>, seen: unknown): CampReveal | null {
  const { stage } = dragon;
  if (stage === 'egg' || rank(stage) <= rank(seen)) return null;
  const line =
    stage === 'hatchling'
      ? "L'œuf a éclos pendant ton absence\u202f!"
      : `Ton dragon a grandi pendant ton absence\u202f: ${stageLabel(stage)}\u202f!`;
  return { stage, line, askName: !dragon.name };
}

// Per hero: the latest stage this page load has shown (the camp's reveal or a victory).
const seenNow = new SvelteMap<number, DragonStage>();

/** The stage the hero last saw: the later of the saved one and this page load's. */
function seenStage(profile: Profile): unknown {
  const saved = profileStore.current?.id === profile.id ? profileStore.current.settings.dragon_seen_stage : profile.settings.dragon_seen_stage;
  const now = seenNow.get(profile.id);
  return now !== undefined && rank(now) > rank(saved) ? now : saved;
}

/** The camp's reveal for this hero's dragon, or null (reactive: a reveal closed is gone). */
export function dragonRevealFor(profile: Profile, dragon: Pick<DragonOut, 'stage' | 'name'>): CampReveal | null {
  return campReveal(dragon, seenStage(profile));
}

/** This page load has shown `stage` (the victory's hatch or growth, saved by the server). */
export function rememberDragonSeen(profileId: number, stage: DragonStage): void {
  if (rank(stage) > rank(seenNow.get(profileId))) seenNow.set(profileId, stage);
}

/** The camp's reveal was shown: remembered at once, then saved (a comfort feature: a failed save
 *  only means it may show again on another page load). */
export async function markDragonSeen(profile: Profile, stage: DragonStage): Promise<void> {
  rememberDragonSeen(profile.id, stage);
  try {
    const updated = await api.profiles.patch(profile.id, { settings: { dragon_seen_stage: stage } });
    if (profileStore.current?.id === profile.id) profileStore.current = updated;
  } catch {
    // Closed for this page load whatever the server said.
  }
}

export function resetDragonSeenForTests(): void {
  seenNow.clear();
}
