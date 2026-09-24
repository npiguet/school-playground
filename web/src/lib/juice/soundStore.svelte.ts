// Mute state ($state): server-authoritative on `profile.settings.mute`, mirrored to
// `localStorage` for instant effect (decision 17) so toggling the TopBar speaker
// doesn't wait on a round-trip. Sound is a convenience, never blocking: API and
// storage failures are swallowed.
import { api } from '../api';
import type { Profile } from '../types';

const MUTE_KEY = 'discorde.mute';

export const soundStore = $state({ muted: false });

/** Seeds the store when a profile loads: the server setting wins when present, else the
 *  locally mirrored value, else unmuted. */
export function initSound(profile: Profile): void {
  if (profile.settings.mute !== undefined) {
    soundStore.muted = profile.settings.mute;
    return;
  }
  try {
    soundStore.muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    soundStore.muted = false;
  }
}

export async function setMuted(profileId: number, muted: boolean): Promise<void> {
  soundStore.muted = muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage unavailable (private mode, quota) - non-fatal.
  }
  try {
    await api.profiles.patch(profileId, { settings: { mute: muted } });
  } catch {
    // Server unreachable - the local mute still applies; next load reconciles.
  }
}
