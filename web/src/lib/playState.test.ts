import { describe, it, expect, beforeEach } from 'vitest';
import {
  battleContext,
  clearPlayState,
  loadPlayState,
  newPlayState,
  playKey,
  resumesUnder,
  savePlayState,
  type BattleUnder,
  type PlayState,
} from './playState';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('playKey', () => {
  it('builds a per-profile, per-text key', () => {
    expect(playKey(1, 2)).toBe('discorde.play.1.2');
  });

  it('builds a distinct key for grimoire mode, so it never shadows a dictation key', () => {
    expect(playKey(1, 2, 'grimoire')).toBe('discorde.play.1.2.grimoire');
    expect(playKey(1, 2, 'dictation')).toBe('discorde.play.1.2');
  });
});

describe('newPlayState', () => {
  it('starts in the intro phase with an empty draft and no help used', () => {
    const s = newPlayState(1, 2, 2);
    expect(s.phase).toBe('intro');
    expect(s.draft).toBe('');
    expect(s.hintsUsed).toBe(0);
    expect(s.submitted).toBe(false);
    expect(s.profileId).toBe(1);
    expect(s.textId).toBe(2);
    expect(s.pace).toBe(2);
    expect(s.mode).toBe('dictation');
  });

  it('supports a grimoire mode', () => {
    const s = newPlayState(1, 2, 1, 'grimoire');
    expect(s.mode).toBe('grimoire');
  });
});

describe('savePlayState / loadPlayState', () => {
  it('round-trips through storage', () => {
    const s = newPlayState(1, 2, 3);
    s.draft = 'Bonjour le monde';
    s.phase = 'dictation';
    savePlayState(s);
    expect(loadPlayState(1, 2)).toEqual(s);
  });

  it('returns null when the key is absent', () => {
    expect(loadPlayState(9, 9)).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(playKey(1, 2), '{');
    expect(loadPlayState(1, 2)).toBeNull();
  });

  it('returns null on a version mismatch', () => {
    const s = newPlayState(1, 2, 1);
    localStorage.setItem(playKey(1, 2), JSON.stringify({ ...s, version: 2 }));
    expect(loadPlayState(1, 2)).toBeNull();
  });

  it('saves a grimoire state under its own key, coexisting with a dictation state', () => {
    const dictationState = newPlayState(1, 2, 2);
    dictationState.draft = 'Bonjour le monde';
    savePlayState(dictationState);

    const grimoireState = newPlayState(1, 2, 1, 'grimoire');
    grimoireState.draft = 'Bonjour le grimoire';
    savePlayState(grimoireState);

    expect(loadPlayState(1, 2)).toEqual(dictationState);
    expect(loadPlayState(1, 2, 'grimoire')).toEqual(grimoireState);
  });

  // Closing item 1: a resumed dictation must not get its « Réécouter » back - the remaining count
  // is saved next to `dictationStep` and survives a reload the same way.
  it('keeps the remaining replay count next to the reading position across a reload', () => {
    const s = newPlayState(1, 2, 2);
    s.phase = 'dictation';
    s.dictationStep = 4;
    s.dictationReplaysLeft = 1;
    savePlayState(s);
    expect(loadPlayState(1, 2)).toMatchObject({ dictationStep: 4, dictationReplaysLeft: 1 });
    expect(newPlayState(1, 2, 2).dictationReplaysLeft).toBeUndefined();
  });

  it('keeps the opponent chosen for this session across a reload (UI4 Ruling C2)', () => {
    const s = newPlayState(1, 2, 1);
    s.opponent = 'lethe';
    savePlayState(s);
    expect(loadPlayState(1, 2)?.opponent).toBe('lethe');
    expect(newPlayState(1, 2, 1).opponent).toBeUndefined();
  });
});

describe('clearPlayState', () => {
  it('removes the stored state', () => {
    const s = newPlayState(1, 2, 1);
    savePlayState(s);
    clearPlayState(1, 2);
    expect(loadPlayState(1, 2)).toBeNull();
  });

  it('only removes the state for the given mode, leaving the other mode intact', () => {
    const dictationState = newPlayState(1, 2, 1);
    savePlayState(dictationState);
    const grimoireState = newPlayState(1, 2, 1, 'grimoire');
    savePlayState(grimoireState);

    clearPlayState(1, 2, 'grimoire');

    expect(loadPlayState(1, 2)).toEqual(dictationState);
    expect(loadPlayState(1, 2, 'grimoire')).toBeNull();
  });
});

// UI4 Ruling C2c: a saved battle records the encounter and quest it was started under; resuming
// compares encounters, never opponents (Éris fights the boss, every grimoire and a free text alike).
describe('the battle a save belongs to (Ruling C2c)', () => {
  function saved(phase: PlayState['phase'], under: BattleUnder): PlayState {
    const s = newPlayState(1, 2, 1, 'dictation', under);
    s.phase = phase;
    s.opponent = 'eris';
    return s;
  }
  const free = { encounter: null, quest: null, help: null };
  const boss = { encounter: 'eris', quest: 7, help: 3 };

  it('records the encounter and quest it was started under, and keeps them through storage', () => {
    const s = newPlayState(1, 2, 3, 'dictation', boss);
    expect(s.encounter).toBe('eris');
    expect(s.quest).toBe(7);
    s.phase = 'dictation';
    savePlayState(s);
    expect(loadPlayState(1, 2)).toMatchObject({ encounter: 'eris', quest: 7, help: 3 });
    expect(newPlayState(1, 2, 1)).toMatchObject({ encounter: null, quest: null, help: null });
  });

  // Ruling C2d: the boss link's help stage is the battle's, even reopened from the shelves (no ?help=).
  it("keeps the help stage the battle's link imposed, and an older save takes the link's", () => {
    expect(battleContext(saved('proofreading', boss), { encounter: null, quest: null, help: null }).help).toBe(3);
    expect(battleContext(saved('proofreading', free), { encounter: null, quest: null, help: 2 }).help).toBeNull();
    const old = saved('proofreading', boss);
    delete old.help;
    expect(battleContext(old, { encounter: null, quest: null, help: 2 }).help).toBe(2);
    expect(battleContext(old, { encounter: null, quest: null }).help).toBeNull();
  });

  it('an intro never resumes', () => {
    expect(resumesUnder(saved('intro', boss), 'eris')).toBe(false);
    expect(resumesUnder(saved('intro', free), null)).toBe(false);
  });

  it('a free save (Éris as the opponent) never passes for the boss fight', () => {
    for (const phase of ['dictation', 'proofreading', 'results'] as const) {
      expect(resumesUnder(saved(phase, free), 'eris'), phase).toBe(false);
    }
  });

  it('a boss save never passes for a lieutenant, nor a lieutenant save for the boss', () => {
    expect(resumesUnder(saved('proofreading', boss), 'hydre')).toBe(false);
    expect(resumesUnder(saved('proofreading', { encounter: 'hydre', quest: 3 }), 'eris')).toBe(false);
  });

  it('resumes under its own encounter, and from a link with none (the shelves)', () => {
    expect(resumesUnder(saved('proofreading', boss), 'eris')).toBe(true);
    expect(resumesUnder(saved('proofreading', boss), null)).toBe(true);
    expect(resumesUnder(saved('results', free), null)).toBe(true);
  });

  it('an older save without the field counts as started under no encounter', () => {
    const old = saved('dictation', free);
    delete old.encounter;
    delete old.quest;
    delete old.help;
    expect(resumesUnder(old, null)).toBe(true);
    expect(resumesUnder(old, 'eris')).toBe(false);
    expect(battleContext(old, boss)).toEqual({ encounter: null, quest: null, help: 3 });
  });

  it("a battle runs under its own encounter and quest once it has a state, the URL's before", () => {
    expect(battleContext(null, boss)).toEqual(boss);
    expect(battleContext(saved('proofreading', boss), free)).toEqual(boss);
    expect(battleContext(saved('proofreading', free), boss)).toEqual(free);
  });
});
