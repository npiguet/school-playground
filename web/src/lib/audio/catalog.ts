// The camp's sounds (scenes UI spec §7): five quiet loops and nine short effects, all CC0
// (ASSETS-LICENSES.md), AAC in .m4a for the iPad. The paths are fixed here (UI5 Task 1) so the
// sourcing lane produces exactly these files and the engine lane plays them without waiting for it.
// `mix` is each sound's level inside its channel, set by ear in Task 3b.
import type { SceneId } from '../scene/types';
import type { BackdropId } from '../battle/battle';

export type TrackId = 'sea' | 'camp' | 'temple' | 'lair' | 'battle';
export type SfxId = 'tap' | 'seal' | 'unroll' | 'chime' | 'growth' | 'hmpf' | 'laurel' | 'strike' | 'fanfare';

export interface SoundDef {
  src: string;
  mix: number;
}

const track = (id: TrackId, mix = 1): SoundDef => ({ src: `/audio/music/${id}.m4a`, mix });
const effect = (id: SfxId, mix = 1): SoundDef => ({ src: `/audio/sfx/${id}.m4a`, mix });

export const TRACKS: Record<TrackId, SoundDef> = {
  sea: track('sea'),
  camp: track('camp'),
  temple: track('temple'),
  lair: track('lair'),
  battle: track('battle', 0.9),
};

export const SFX: Record<SfxId, SoundDef> = {
  tap: effect('tap', 0.6),
  seal: effect('seal'),
  unroll: effect('unroll', 0.8),
  chime: effect('chime'),
  growth: effect('growth'),
  hmpf: effect('hmpf', 0.8),
  laurel: effect('laurel'),
  strike: effect('strike', 0.8),
  fanfare: effect('fanfare'),
};

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
export const SFX_IDS = Object.keys(SFX) as SfxId[];

/** Ruling E4: the loop of each place. */
export const SCENE_MUSIC: Record<SceneId, TrackId> = {
  title: 'sea',
  camp: 'camp',
  nest: 'camp',
  cabin: 'camp',
  library: 'temple',
  delphi: 'temple',
  war: 'lair',
};

/** Ruling E4: every battle ground plays the battle loop; Éris in her lair plays hers. */
export function battleTrack(backdrop: BackdropId): TrackId {
  return backdrop === 'lair' ? 'lair' : 'battle';
}

// Ruling E17: the size budget (assets.test.ts, Task 3).
export const MUSIC_BUDGET_BYTES = 8 * 1024 * 1024;
export const TRACK_MAX_BYTES = 2 * 1024 * 1024;
export const SFX_MAX_BYTES = 64 * 1024;
export const SFX_BUDGET_BYTES = 512 * 1024;
export const LOOP_MIN_S = 30;
export const LOOP_MAX_S = 90;
