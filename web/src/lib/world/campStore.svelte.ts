// The camp hub's data store: one shared `$state` so the TopBar, Camp screen and BreakNudge can
// all read the latest dragon/xp/weekly snapshot without re-fetching. `refreshCamp` is tolerant of
// the world API not existing yet (SP3 server Tasks 2-3 land separately) - a 404/network failure
// just surfaces a friendly French message, never a crash.
import { ApiError } from '../api';
import { worldApi } from './api';
import type { CampResponse } from './types';

export const campStore = $state<{ data: CampResponse | null; loading: boolean; error: string }>({
  data: null,
  loading: false,
  error: '',
});

export async function refreshCamp(profileId: number): Promise<void> {
  campStore.loading = true;
  campStore.error = '';
  try {
    campStore.data = await worldApi.camp(profileId);
  } catch (e) {
    campStore.error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
  } finally {
    campStore.loading = false;
  }
}
