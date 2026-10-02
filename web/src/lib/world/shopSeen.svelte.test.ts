import { beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, b: { settings: object }) => patch(id, b) } } }));

import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import { markShopSeen, resetShopSeenForTests, shopSeenFor } from './shopSeen.svelte';

const hero = (settings: object) => ({ id: 9, name: 'Io', avatar: 'chouette', level: '10H', has_pin: false, created_at: '', settings }) as unknown as Profile;

beforeEach(() => {
  patch.mockClear();
  resetShopSeenForTests();
  profileStore.current = null;
});

describe("the stall's pieces the dragon already named (SP4 final review I1)", () => {
  it('reads the saved setting, a missing or junk one as nothing named', () => {
    expect(shopSeenFor(hero({}))).toEqual([]);
    expect(shopSeenFor(hero({ shop_seen: 'decor:amphore' }))).toEqual([]);
    expect(shopSeenFor(hero({ shop_seen: ['decor:amphore', 3] }))).toEqual(['decor:amphore']);
  });

  it('saves the pieces named with the ones named before', async () => {
    const p = hero({ shop_seen: ['decor:amphore'], tours: ['camp'] });
    profileStore.current = p;
    await markShopSeen(p, ['decor:amphore', 'house:villa']);
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { shop_seen: ['decor:amphore', 'house:villa'] } });
    expect(profileStore.current?.settings.shop_seen).toEqual(['decor:amphore', 'house:villa']);
  });

  it('remembers them for this page load even when the save fails', async () => {
    const p = hero({});
    patch.mockRejectedValueOnce(new Error('offline'));
    await markShopSeen(p, ['decor:chouette']);
    expect(shopSeenFor(p)).toEqual(['decor:chouette']);
  });
});
