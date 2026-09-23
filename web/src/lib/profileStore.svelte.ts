// Current profile ($state) + persistence: the chosen profile id survives a
// reload (localStorage), whether its PIN was entered this tab session does not
// (sessionStorage) - so switching device/browser or closing the tab always
// re-asks for the PIN.
import { api } from './api';
import type { Profile } from './types';

const PROFILE_ID_KEY = 'discorde.profileId';
const UNLOCKED_KEY = 'discorde.unlocked';

export const profileStore = $state<{ current: Profile | null; loading: boolean }>({
  current: null,
  loading: false,
});

export async function loadProfile(id: number): Promise<Profile> {
  profileStore.loading = true;
  try {
    const profile = await api.profiles.get(id);
    profileStore.current = profile;
    try {
      localStorage.setItem(PROFILE_ID_KEY, String(id));
    } catch {
      // Storage unavailable (private mode, etc.) - non-fatal.
    }
    return profile;
  } finally {
    profileStore.loading = false;
  }
}

function readUnlocked(): number[] {
  try {
    const raw = sessionStorage.getItem(UNLOCKED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUnlocked(ids: number[]) {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable - non-fatal.
  }
}

export function isUnlocked(id: number): boolean {
  return readUnlocked().includes(id);
}

export function markUnlocked(id: number) {
  const ids = readUnlocked();
  if (!ids.includes(id)) writeUnlocked([...ids, id]);
}

export function clearProfile() {
  const id = profileStore.current?.id;
  profileStore.current = null;
  try {
    localStorage.removeItem(PROFILE_ID_KEY);
  } catch {
    // Storage unavailable - non-fatal.
  }
  if (id !== undefined) {
    writeUnlocked(readUnlocked().filter((x) => x !== id));
  }
}

export function storedProfileId(): number | null {
  try {
    const raw = localStorage.getItem(PROFILE_ID_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}
