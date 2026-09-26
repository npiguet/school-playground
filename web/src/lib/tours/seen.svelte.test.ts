import { beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, b: { settings: object }) => patch(id, b) } } }));

import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import { markTourSeen, resetSeenForTests, resetTours, shouldTour } from './seen.svelte';

const hero = (settings: object) => ({ id: 9, name: 'Io', avatar: 'chouette', level: '10H', has_pin: false, help_stage: 1, created_at: '', settings }) as unknown as Profile;

beforeEach(() => {
  patch.mockClear();
  resetSeenForTests();
});

describe('seen tours (Ruling E13)', () => {
  it('marks a tour seen for this page load even when the save fails, and saves the whole list', async () => {
    const p = hero({ tours: ['nest'] });
    profileStore.current = p;
    patch.mockRejectedValueOnce(new Error('offline'));
    expect(shouldTour(p, 'library')).toBe(true);
    await markTourSeen(p, 'library');
    expect(shouldTour(p, 'library')).toBe(false);
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: ['nest', 'library'] } });
  });

  it('writes onboarded with the camp tour, and the lyre clears everything', async () => {
    const p = hero({});
    profileStore.current = p;
    await markTourSeen(p, 'camp');
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: ['camp'], onboarded: true } });
    expect(profileStore.current!.settings).toMatchObject({ tours: ['camp'], onboarded: true });
    await resetTours(9);
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: [], onboarded: false } });
    expect(shouldTour(profileStore.current!, 'camp')).toBe(true);
  });
});
