import { describe, expect, it } from 'vitest';
import { SCENES } from '../world/scenes';
import { SCENE_MUSIC, SFX, SFX_IDS, TRACKS, TRACK_IDS, battleTrack } from './catalog';

describe('the sounds of the camp (spec §7, Ruling E4)', () => {
  it('gives every place its loop and every scene definition reads it', () => {
    expect(SCENE_MUSIC).toEqual({ title: 'sea', camp: 'camp', nest: 'camp', cabin: 'camp', library: 'temple', delphi: 'temple', war: 'lair' });
    for (const s of SCENES) expect(s.ambience.music, s.id).toBe(SCENE_MUSIC[s.id]);
  });

  it('plays the battle loop on every ground but her lair', () => {
    expect(['river', 'coast', 'temple'].map((b) => battleTrack(b as 'river'))).toEqual(['battle', 'battle', 'battle']);
    expect(battleTrack('lair')).toBe('lair');
  });

  it('keeps every sound as an .m4a under /audio, mixed between 0 and 1', () => {
    expect([...TRACK_IDS].sort()).toEqual(['battle', 'camp', 'lair', 'sea', 'temple']);
    expect([...SFX_IDS].sort()).toEqual(['chime', 'fanfare', 'growth', 'hmpf', 'laurel', 'seal', 'strike', 'tap', 'unroll']);
    for (const [id, d] of Object.entries(TRACKS)) expect(d.src).toBe(`/audio/music/${id}.m4a`);
    for (const [id, d] of Object.entries(SFX)) expect(d.src).toBe(`/audio/sfx/${id}.m4a`);
    for (const d of [...Object.values(TRACKS), ...Object.values(SFX)]) {
      expect(d.mix).toBeGreaterThan(0);
      expect(d.mix).toBeLessThanOrEqual(1);
    }
  });
});
