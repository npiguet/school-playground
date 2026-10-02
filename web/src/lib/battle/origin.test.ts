import { describe, expect, it } from 'vitest';
import { battleOriginOf, noteBattleOrigin, quitTarget, ORIGIN_KEY } from './origin';
import { matchRoute } from '../routes';

/** A history entry's state, as the router sees it. */
function fakeHistory(state: unknown = null) {
  const h = {
    state,
    replaceState(data: unknown) {
      h.state = data;
    },
  };
  return h;
}

describe('quitTarget', () => {
  it('goes back to the place the battle was opened from', () => {
    expect(quitTarget('#/p/3/parchemins', 3)).toBe('#/p/3/parchemins');
    expect(quitTarget('#/p/3/quetes', 3)).toBe('#/p/3/quetes');
    expect(quitTarget('#/p/3/monstres/hydre', 3)).toBe('#/p/3/monstres/hydre');
    expect(quitTarget('#/p/3/eris', 3)).toBe('#/p/3/eris');
  });

  it('falls back to the camp with no origin, a battle, the title screens or another hero', () => {
    for (const origin of [null, '', '#/', '#/nowhere', '#/profiles/new', '#/p/3/play/7', '#/p/3/grimoire/7', '#/p/4/parchemins']) {
      expect(quitTarget(origin, 3), String(origin)).toBe('#/p/3/camp');
    }
  });
});

describe('noteBattleOrigin', () => {
  it('stamps a battle entered from a place with that place', () => {
    const h = fakeHistory();
    noteBattleOrigin('#/p/3/parchemins', matchRoute('#/p/3/play/7'), h);
    expect(battleOriginOf(h.state)).toBe('#/p/3/parchemins');
  });

  it('keeps the other keys of the entry state (an overlay tag)', () => {
    const h = fakeHistory({ discordePanel: true });
    noteBattleOrigin('#/p/3/quetes', matchRoute('#/p/3/play/7'), h);
    expect(h.state).toEqual({ discordePanel: true, [ORIGIN_KEY]: '#/p/3/quetes' });
  });

  it('carries the origin on from a battle to the next (the muster to the grimoire, « Revoir »)', () => {
    const h = fakeHistory();
    noteBattleOrigin('#/p/3/temple', matchRoute('#/p/3/play/7'), h);
    const next = fakeHistory();
    noteBattleOrigin('#/p/3/play/7', matchRoute('#/p/3/grimoire/7'), next);
    expect(battleOriginOf(next.state)).toBe('#/p/3/temple');
  });

  it('leaves an entry already stamped as it is (Back into a battle, after an overlay)', () => {
    const h = fakeHistory({ [ORIGIN_KEY]: '#/p/3/parchemins' });
    noteBattleOrigin('#/p/3/cabane?panel=heros', matchRoute('#/p/3/play/7'), h);
    expect(battleOriginOf(h.state)).toBe('#/p/3/parchemins');
  });

  it('stamps nothing outside a battle, nor a battle with no way it came (a deep link)', () => {
    const place = fakeHistory();
    noteBattleOrigin('#/p/3/play/7', matchRoute('#/p/3/parchemins'), place);
    expect(place.state).toBeNull();
    const deep = fakeHistory();
    noteBattleOrigin('', matchRoute('#/p/3/play/8'), deep);
    expect(battleOriginOf(deep.state)).toBeNull();
  });
});
