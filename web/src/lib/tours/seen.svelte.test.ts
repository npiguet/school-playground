import { beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, b: { settings: object }) => patch(id, b) } } }));

import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import { giveUpTour, markTourSeen, resetSeenForTests, resetTours, shouldTour } from './seen.svelte';

const hero = (settings: object) => ({ id: 9, name: 'Io', avatar: 'chouette', level: '10H', has_pin: false, created_at: '', settings }) as unknown as Profile;

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

  it('never drops a seen tour: saves run one at a time, each with every tour seen so far', async () => {
    const p = hero({ tours: ['nest'] });
    profileStore.current = p;
    // The first save is slow: the second must wait for it, not race it (the server keeps the last list).
    let release!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    patch.mockImplementationOnce(async (id, body) => {
      await slow;
      return { id, settings: body.settings };
    });
    const first = markTourSeen(p, 'library');
    const second = markTourSeen(p, 'war');
    await new Promise((r) => setTimeout(r, 0));
    expect(patch).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: ['nest', 'library', 'war'] } });
  });

  it('makes good a failed save with the next one', async () => {
    const p = hero({});
    profileStore.current = p;
    patch.mockRejectedValueOnce(new Error('offline'));
    await markTourSeen(p, 'camp');
    await markTourSeen(p, 'cabin');
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { tours: ['camp', 'cabin'], onboarded: true } });
  });

  it('gives a tour up for this page load without saving it (no /camp to read the dragon from)', () => {
    const p = hero({});
    giveUpTour(p, 'library');
    expect(shouldTour(p, 'library')).toBe(false);
    expect(shouldTour(p, 'war')).toBe(true);
    expect(patch).not.toHaveBeenCalled();
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
