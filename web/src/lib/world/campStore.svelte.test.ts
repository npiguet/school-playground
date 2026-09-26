import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ worldApi: { camp: vi.fn() } }));

import { worldApi } from './api';
import { campFor, campStore, refreshCamp, replaceCamp } from './campStore.svelte';
import type { CampResponse } from './types';

// A promise this test controls the resolution/rejection timing of, so an "older" call can be made
// to land after a "newer" one (UI3a Task 9 review round 2).
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fakeCamp = (mark: string) => ({ mark } as unknown as CampResponse);

describe('refreshCamp (UI3a Task 9 review round 2): a generation token guards the shared store', () => {
  beforeEach(() => {
    vi.mocked(worldApi.camp).mockReset();
    campStore.data = null;
    campStore.error = '';
    campStore.loading = false;
  });

  it('keeps the newer response when an older, overlapping call resolves after it', async () => {
    const first = deferred<CampResponse>();
    const second = deferred<CampResponse>();
    vi.mocked(worldApi.camp).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    // Mirrors the camp -> tent -> camp round trip: Camp's own effect starts `first`, the tent's
    // PlaceScene starts `second` moments later, and (the bug) `second` can land before `first`.
    const p1 = refreshCamp(1);
    const p2 = refreshCamp(1);

    const newer = fakeCamp('newer');
    second.resolve(newer);
    await p2;
    // $state proxies an assigned object, so the stored value is compared structurally
    // (toEqual), not by reference.
    expect(campStore.data).toEqual(newer);
    expect(campStore.loading).toBe(false);

    const older = fakeCamp('older');
    first.resolve(older);
    await p1;
    expect(campStore.data, 'the older, now-superseded response must not win').toEqual(newer);
    expect(campStore.loading, 'a superseded resolution must not leave loading stuck').toBe(false);
  });

  it('does not let a superseded rejection overwrite a newer success, and loading still ends false', async () => {
    const first = deferred<CampResponse>();
    const second = deferred<CampResponse>();
    vi.mocked(worldApi.camp).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const p1 = refreshCamp(1);
    const p2 = refreshCamp(1);

    const newer = fakeCamp('newer');
    second.resolve(newer);
    await p2;

    first.reject(new Error('the older request failed after being superseded'));
    await p1;

    expect(campStore.data).toEqual(newer);
    expect(campStore.error, 'a superseded failure must not surface an error over good data').toBe('');
    expect(campStore.loading).toBe(false);
  });

  it('a lone refresh still behaves normally: data set, loading ends false', async () => {
    const only = fakeCamp('only');
    vi.mocked(worldApi.camp).mockResolvedValueOnce(only);
    await refreshCamp(1);
    expect(campStore.data).toEqual(only);
    expect(campStore.error).toBe('');
    expect(campStore.loading).toBe(false);
  });
});

describe('replaceCamp (final review I2): an optimistic write never lands on another hero', () => {
  const heroCamp = (id: number, tint: string) => ({ profile: { id }, dragon: { tint } }) as unknown as CampResponse;

  it("writes over this hero's own snapshot only", () => {
    campStore.data = heroCamp(1, 'bronze');
    replaceCamp(2, heroCamp(2, 'jade'));
    expect(campStore.data?.profile.id).toBe(1);
    replaceCamp(1, heroCamp(2, 'jade'));
    expect(campFor(1)?.dragon.tint).toBe('bronze');
    replaceCamp(1, heroCamp(1, 'ecume'));
    expect(campFor(1)?.dragon.tint).toBe('ecume');
    campStore.data = null;
    replaceCamp(1, heroCamp(1, 'jade'));
    expect(campStore.data).toBeNull();
  });
});
