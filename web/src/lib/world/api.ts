// Thin fetch wrappers for the SP3 world/progression endpoints (Task 3's API table).
// Reuses SP1's `request<T>` (exported from `../api`) so error handling (ApiError,
// non-2xx detail flattening) stays identical to the rest of the app.
import { request } from '../api';
import type {
  WorldCatalog,
  CampResponse,
  DragonOut,
  QuestOut,
  QuestStatus,
  OracleOut,
  ScrollKey,
  RewardOut,
  Tint,
} from './types';

export const worldApi = {
  world: () => request<WorldCatalog>('GET', '/api/world'),

  camp: (profileId: number) => request<CampResponse>('GET', `/api/profiles/${profileId}/camp`),

  patchDragon: (profileId: number, body: { name?: string; tint?: Tint }) =>
    request<DragonOut>('PATCH', `/api/profiles/${profileId}/dragon`, body),

  quests: (profileId: number, status?: QuestStatus) =>
    request<QuestOut[]>(
      'GET',
      `/api/profiles/${profileId}/quests${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),

  createQuest: (profileId: number, target: string) =>
    request<QuestOut>('POST', `/api/profiles/${profileId}/quests`, { target }),

  shelveQuest: (profileId: number, questId: number) =>
    request<QuestOut>('POST', `/api/profiles/${profileId}/quests/${questId}/shelve`),

  oracle: (profileId: number) => request<OracleOut>('GET', `/api/profiles/${profileId}/oracle`),

  consult: (profileId: number, body: { scroll: ScrollKey; lieutenant?: string }) =>
    request<{ oracle: OracleOut; quest: QuestOut }>('POST', `/api/profiles/${profileId}/oracle`, body),

  boss: (profileId: number) =>
    request<{ quest: QuestOut; text_id: number; tier: number }>(
      'POST',
      `/api/profiles/${profileId}/boss`,
    ),

  rewards: (profileId: number) => request<RewardOut[]>('GET', `/api/profiles/${profileId}/rewards`),

  patchReward: (profileId: number, id: string, equipped: boolean) =>
    request<RewardOut>('PATCH', `/api/profiles/${profileId}/rewards/${id}`, { equipped }),

  /** Spec 2026-09-29 drachmes §2 (R5): buy an item at Hermès's stall; 409 with Hermès's line when it
   *  is owned, not on sale or the purse is short. */
  buy: (profileId: number, item: string) =>
    request<{ reward: RewardOut; drachmes: number }>('POST', `/api/profiles/${profileId}/purchases`, { item }),
};
