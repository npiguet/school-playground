import { beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.fn(async (id: number, body: { settings: object }) => ({ id, settings: body.settings }));
vi.mock('../api', () => ({ api: { profiles: { patch: (id: number, b: { settings: object }) => patch(id, b) } } }));

import { profileStore } from '../profileStore.svelte';
import type { Profile } from '../types';
import { campReveal, dragonRevealFor, markDragonSeen, rememberDragonSeen, resetDragonSeenForTests } from './dragonSeen.svelte';

const hero = (settings: object) => ({ id: 9, name: 'Io', avatar: 'chouette', level: '10H', has_pin: false, created_at: '', settings }) as unknown as Profile;

beforeEach(() => {
  patch.mockClear();
  resetDragonSeenForTests();
  profileStore.current = null;
});

describe('the camp reveals a dragon that grew while she was away (final review I3)', () => {
  it('reveals a stage beyond the one last seen, with its name asked when it has none', () => {
    expect(campReveal({ stage: 'young', name: null }, 'hatchling')).toEqual({
      stage: 'young',
      line: 'Ton dragon a grandi pendant ton absence\u202f: Jeune dragon\u202f!',
      askName: true,
    });
    expect(campReveal({ stage: 'ancestral', name: 'Braise' }, 'adult')).toEqual({
      stage: 'ancestral',
      line: 'Ton dragon a grandi pendant ton absence\u202f: Dragon ancestral\u202f!',
      askName: false,
    });
    // Two stages at once read the same: the stage it is now.
    expect(campReveal({ stage: 'adult', name: 'Braise' }, 'hatchling')?.line).toBe('Ton dragon a grandi pendant ton absence\u202f: Dragon adulte\u202f!');
  });

  it('says the egg hatched when it is a hatchling now', () => {
    expect(campReveal({ stage: 'hatchling', name: null }, 'egg')).toEqual({ stage: 'hatchling', line: "L'œuf a éclos pendant ton absence\u202f!", askName: true });
  });

  it('reveals nothing for a stage already seen, an older one, or an egg', () => {
    expect(campReveal({ stage: 'young', name: 'Braise' }, 'young')).toBeNull();
    expect(campReveal({ stage: 'young', name: 'Braise' }, 'illustre')).toBeNull();
    expect(campReveal({ stage: 'egg', name: null }, undefined)).toBeNull();
    expect(campReveal({ stage: 'egg', name: null }, 'egg')).toBeNull();
  });

  it('treats a missing or unreadable setting as never shown: once for the current stage', () => {
    expect(campReveal({ stage: 'hatchling', name: 'Braise' }, undefined)?.line).toBe("L'œuf a éclos pendant ton absence\u202f!");
    expect(campReveal({ stage: 'young', name: 'Braise' }, null)?.stage).toBe('young');
    expect(campReveal({ stage: 'young', name: 'Braise' }, 'dragon')?.stage).toBe('young');
    expect(campReveal({ stage: 'young', name: 'Braise' }, 3)?.stage).toBe('young');
  });

  it('reads the saved setting, and closes for this page load even when the save fails', async () => {
    const p = hero({ dragon_seen_stage: 'hatchling', tours: ['camp'] });
    profileStore.current = p;
    const dragon = { stage: 'young' as const, name: null };
    expect(dragonRevealFor(p, dragon)?.stage).toBe('young');
    patch.mockRejectedValueOnce(new Error('offline'));
    await markDragonSeen(p, 'young');
    expect(patch).toHaveBeenLastCalledWith(9, { settings: { dragon_seen_stage: 'young' } });
    expect(dragonRevealFor(p, dragon)).toBeNull();
  });

  it('keeps the saved profile up to date once the save lands', async () => {
    const p = hero({});
    profileStore.current = p;
    await markDragonSeen(p, 'adult');
    expect(profileStore.current?.settings.dragon_seen_stage).toBe('adult');
  });

  it('a victory that showed the growth closes it too, without saving (the server did)', () => {
    const p = hero({ dragon_seen_stage: 'egg' });
    rememberDragonSeen(9, 'hatchling');
    expect(dragonRevealFor(p, { stage: 'hatchling', name: null })).toBeNull();
    expect(patch).not.toHaveBeenCalled();
    // A later growth still shows; an older stage remembered never lowers what was seen.
    rememberDragonSeen(9, 'egg');
    expect(dragonRevealFor(p, { stage: 'young', name: null })?.stage).toBe('young');
  });
});
