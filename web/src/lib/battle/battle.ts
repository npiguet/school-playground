// Who fights where (UI4 Ruling C2): the opponent on the right of the battle stage and the ground it
// fights on, from the art that exists (docs/art/scenes.md "Battle backdrops"). Pure.
import { battleTrack, type TrackId } from '../audio/catalog';
import { ART } from '../world/art';
import { lieutenantName } from '../world/eris';
import type { FxPreset } from '../scene/types';
import type { PlayMode } from '../types';
import { LIEUTENANT_ORDER, type DragonStage, type LieutenantKey, type LieutenantState } from '../world/types';

export type OpponentId = LieutenantKey | 'eris';
export type BackdropId = 'river' | 'coast' | 'temple' | 'lair';
export type BattleMode = PlayMode | 'boss';
export type BattlePhase = 'muster' | 'dictation' | 'proofreading' | 'victory';

type Facing = 'left' | 'right';

export function isOpponentId(x: unknown): x is OpponentId {
  return x === 'eris' || (LIEUTENANT_ORDER as readonly unknown[]).includes(x);
}

/** Each lieutenant's ground: the river (the Hydra of Lerna, Lethe the river of forgetting), the sea
 *  coast (Proteus, the Sirens), the ruined temple (Echo, the Chimera). */
export const HOME: Record<LieutenantKey, Exclude<BackdropId, 'lair'>> = {
  hydre: 'river',
  lethe: 'river',
  sirenes: 'coast',
  protee: 'coast',
  echo: 'temple',
  chimere: 'temple',
};

/** `feetY`: where the combatants stand, in % of the backdrop's height (docs/art/scenes.md). */
export const BACKDROPS: Record<BackdropId, { src: string; feetY: number; particles: FxPreset }> = {
  river: { src: ART.scenes.battleRiver, feetY: 80, particles: 'dust' },
  coast: { src: ART.scenes.battleCoast, feetY: 76, particles: 'dust' },
  temple: { src: ART.scenes.battleTemple, feetY: 78, particles: 'dust' },
  lair: { src: ART.scenes.erisLair, feetY: 72, particles: 'embers' },
};

/** Which way each cut-out looks in its file (checked by eye on web/public/art, UI4 Task 1); the stage
 *  mirrors a combatant that does not look toward the other side (Ruling C10). A frontal figure
 *  (Écho, Protée, les Sirènes, Léthé) is 'left': it is never mirrored on the right. The Hydra's heads
 *  and the Chimera's goat and snake heads look right (its lion faces us). The dragon's stages
 *  disagree: the hatchling and the young dragon look right, the adult left; the egg is symmetric. */
export const FACES: Record<OpponentId, Facing> & { dragon: Record<DragonStage, Facing> } = {
  dragon: { egg: 'right', hatchling: 'right', young: 'right', adult: 'left' },
  eris: 'left',
  hydre: 'right',
  echo: 'left',
  chimere: 'right',
  protee: 'left',
  sirenes: 'left',
  lethe: 'left',
};

export interface BattleDef {
  opponent: { id: OpponentId; name: string; art: string; alt: string };
  backdrop: { id: BackdropId; src: string; feetY: number };
  /** `music`: UI5: the loop of this ground (Ruling E4). */
  ambience: { particles: FxPreset; music: TrackId };
  /** Dialogue event keys for UI5 (spec §8); nothing reads them in UI4. */
  narrator: { start: string; victory: string; retreat: string; retry: string };
}

export interface OpponentInput {
  mode: BattleMode;
  encounter: string | null;
  textId: number | null;
  lieutenants: Pick<LieutenantState, 'key' | 'available' | 'neutralised'>[];
}

export function opponentFor(i: OpponentInput): OpponentId {
  if (i.mode === 'boss' || i.encounter === 'eris') return 'eris';
  if (i.encounter && isOpponentId(i.encounter)) return i.encounter;
  if (i.mode === 'grimoire') return 'eris';
  const open = i.lieutenants.filter((l) => l.available && !l.neutralised && isOpponentId(l.key));
  if (open.length === 0) return 'eris';
  return open[Math.abs(i.textId ?? 0) % open.length].key as LieutenantKey;
}

export function battleFor(opponent: OpponentId, ctx: { mode: BattleMode; encounter: string | null }): BattleDef {
  const backdropId: BackdropId =
    opponent === 'eris' ? (ctx.mode === 'boss' || ctx.encounter === 'eris' ? 'lair' : 'temple') : HOME[opponent];
  const backdrop = BACKDROPS[backdropId];
  const name = opponent === 'eris' ? 'Éris' : lieutenantName(opponent);
  return {
    opponent: { id: opponent, name, art: opponent === 'eris' ? ART.eris : ART.lieutenants[opponent], alt: name },
    backdrop: { id: backdropId, src: backdrop.src, feetY: backdrop.feetY },
    ambience: { particles: backdrop.particles, music: battleTrack(backdropId) },
    narrator: { start: 'battle.start', victory: 'battle.victory', retreat: 'battle.retreat', retry: 'battle.retry' },
  };
}
