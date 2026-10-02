import { describe, expect, it } from 'vitest';
import { battleOriginOf, clearBattleStamp, noteBattleOrigin, quitPlan, quitTarget, stampFirstEntry, DIRECT_KEY, ORIGIN_KEY } from './origin';
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
  it('stamps a battle entered from a place with that place, directly: the entry before it is the place', () => {
    const h = fakeHistory();
    noteBattleOrigin('#/p/3/parchemins', matchRoute('#/p/3/play/7'), h);
    expect(battleOriginOf(h.state)).toEqual({ from: '#/p/3/parchemins', direct: true });
  });

  it('keeps the other keys of the entry state (an overlay tag)', () => {
    const h = fakeHistory({ discordePanel: true });
    noteBattleOrigin('#/p/3/quetes', matchRoute('#/p/3/play/7'), h);
    expect(h.state).toEqual({ discordePanel: true, [ORIGIN_KEY]: '#/p/3/quetes', [DIRECT_KEY]: true });
  });

  it('carries the origin on from a battle to the next (the muster to the grimoire, « Revoir »), not directly', () => {
    const h = fakeHistory();
    noteBattleOrigin('#/p/3/temple', matchRoute('#/p/3/play/7'), h);
    const next = fakeHistory();
    noteBattleOrigin('#/p/3/play/7', matchRoute('#/p/3/grimoire/7'), next);
    expect(battleOriginOf(next.state)).toEqual({ from: '#/p/3/temple', direct: false });
  });

  it('never restamps an entry: Back into a battle, after an overlay, finds its own stamp', () => {
    const h = fakeHistory({ [ORIGIN_KEY]: '#/p/3/parchemins', [DIRECT_KEY]: true });
    noteBattleOrigin('#/p/3/cabane?panel=heros', matchRoute('#/p/3/play/7'), h);
    expect(battleOriginOf(h.state)).toEqual({ from: '#/p/3/parchemins', direct: true });
  });

  it('stamps nothing outside a battle', () => {
    const place = fakeHistory();
    noteBattleOrigin('#/p/3/play/7', matchRoute('#/p/3/parchemins'), place);
    expect(place.state).toBeNull();
  });
});

describe('a deep link', () => {
  it('stamps the first entry with no origin, and Back into it keeps that', () => {
    const h = fakeHistory();
    stampFirstEntry('#/p/3/play/8', h);
    expect(battleOriginOf(h.state)).toEqual({ from: null, direct: false });
    // The HUD's hero chip, then its seal stepping back: the entry is found stamped, not given the
    // hero panel as its origin (review I2).
    noteBattleOrigin('#/p/3/cabane?panel=heros', matchRoute('#/p/3/play/8'), h);
    expect(battleOriginOf(h.state)).toEqual({ from: null, direct: false });
    expect(quitPlan(h.state, 3)).toEqual({ kind: 'replace', to: '#/p/3/camp' });
  });

  it('stamps nothing for a first entry that is no battle, and keeps a reloaded stamp', () => {
    const place = fakeHistory();
    stampFirstEntry('#/p/3/camp', place);
    expect(place.state).toBeNull();
    const reloaded = fakeHistory({ [ORIGIN_KEY]: '#/p/3/quetes', [DIRECT_KEY]: true });
    stampFirstEntry('#/p/3/play/8', reloaded);
    expect(battleOriginOf(reloaded.state)).toEqual({ from: '#/p/3/quetes', direct: true });
  });
});

describe('quitPlan', () => {
  it('steps back when the entry before the battle is its origin', () => {
    expect(quitPlan({ [ORIGIN_KEY]: '#/p/3/parchemins', [DIRECT_KEY]: true }, 3)).toEqual({ kind: 'back' });
  });

  it("replaces the battle's entry with the origin when it was carried, or with the camp when there is none", () => {
    expect(quitPlan({ [ORIGIN_KEY]: '#/p/3/temple', [DIRECT_KEY]: false }, 3)).toEqual({ kind: 'replace', to: '#/p/3/temple' });
    expect(quitPlan({ [ORIGIN_KEY]: '', [DIRECT_KEY]: false }, 3)).toEqual({ kind: 'replace', to: '#/p/3/camp' });
    expect(quitPlan(null, 3)).toEqual({ kind: 'replace', to: '#/p/3/camp' });
    // A direct origin that is no place of this hero's is not stepped back to.
    expect(quitPlan({ [ORIGIN_KEY]: '#/p/4/parchemins', [DIRECT_KEY]: true }, 3)).toEqual({ kind: 'replace', to: '#/p/3/camp' });
  });

  it('goes to a given place (Éris\'s « Retour au camp »): back only when that place is the direct origin', () => {
    expect(quitPlan({ [ORIGIN_KEY]: '#/p/3/camp', [DIRECT_KEY]: true }, 3, '#/p/3/camp')).toEqual({ kind: 'back' });
    expect(quitPlan({ [ORIGIN_KEY]: '#/p/3/parchemins', [DIRECT_KEY]: true }, 3, '#/p/3/camp')).toEqual({ kind: 'replace', to: '#/p/3/camp' });
  });
});

describe('clearBattleStamp', () => {
  it("drops the stamp and the overlay tag from the replaced entry (WebKit keeps a replaced entry's state)", () => {
    const h = fakeHistory({ [ORIGIN_KEY]: '#/p/3/temple', [DIRECT_KEY]: false, discordePanel: true, other: 1 });
    clearBattleStamp(h);
    expect(h.state).toEqual({ other: 1 });
  });
});
