import { describe, it, expect, beforeEach } from 'vitest';
import { clearPlayState, loadPlayState, newPlayState, playKey, savePlayState } from './playState';

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
});

describe('clearPlayState', () => {
  it('removes the stored state', () => {
    const s = newPlayState(1, 2, 1);
    savePlayState(s);
    clearPlayState(1, 2);
    expect(loadPlayState(1, 2)).toBeNull();
  });
});
