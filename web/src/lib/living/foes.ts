// The battle's foes alive (spec 2026-10-03 living battle, "What she sees"; plan Rulings B1, B4): each
// foe's four rigid bones in rig order (tools/art/rig.json's key order, then chest and lift) and its idle
// at 1x; the game plays it at AMPLITUDE (1.5x) like the dragon. No period is shared with the breath, so
// the beat never quite repeats; at 1.5x a turn stays under 6 deg and a drift under 12 frame px (about
// 6 screen px on the biggest battle box): slow and slight. Arrives with LivingDragon's chunk (rigs.ts).
import { ART } from '../world/art';
import type { CreatureMotion, Wave } from './pose';
import type { FoeRig } from './stages';

const w = (amp: number, period: number, phase = 0): Wave => ({ amp, period, phase });

export const FOE_MOTIONS: Record<FoeRig, CreatureMotion> = {
  // Her hair streaming behind her, the locks at her shoulder, the apple arm about the elbow, the robe's hem.
  eris: {
    rigid: ['hair', 'hairFront', 'arm', 'hem'],
    moves: {
      hair: { kind: 'turn', waves: [w(2.0, 5.3, 0.4), w(0.6, 2.3, 1.1)] },
      hairFront: { kind: 'turn', waves: [w(1.2, 4.1, 2.0)] },
      arm: { kind: 'turn', waves: [w(1.2, 6.7, 0.9), w(0.3, 3.1)] },
      hem: { kind: 'turn', waves: [w(0.8, 5.9, 1.7)] },
    },
    breath: { period: 5.1, sx: 0.012, sy: 0.006, lift: 2.0 },
  },
  // Routed: her head (and the hand at her brow) sways, her hair on both sides, a quicker breath.
  eris_flustered: {
    rigid: ['hairL', 'hairR', 'head', 'hem'],
    moves: {
      hairL: { kind: 'turn', waves: [w(1.4, 4.7, 0.3)] },
      hairR: { kind: 'turn', waves: [w(-1.6, 5.5, 1.2)] },
      head: { kind: 'turn', waves: [w(1.0, 3.3), w(0.4, 1.7, 0.8)] },
      hem: null,
    },
    breath: { period: 3.6, sx: 0.014, sy: 0.008, lift: 2.4 },
  },
  // The six heads in three pairs (the user: "make a couple of heads move together as a pair"), the tail tip.
  hydre: {
    rigid: ['pairHaut', 'pairDroite', 'pairBas', 'tail'],
    moves: {
      // The top neck lies against the upper-right one, and the middle-left snout against the top neck:
      // at 2.0 / 1.8 / 1.6 deg those seams tore at 3x (the dragon-rig skill's foe notes).
      pairHaut: { kind: 'turn', waves: [w(1.2, 5.7), w(0.3, 2.6, 0.9)] },
      pairDroite: { kind: 'turn', waves: [w(-1.1, 6.3, 1.4), w(0.3, 2.2)] },
      pairBas: { kind: 'turn', waves: [w(1.1, 4.9, 2.6), w(0.3, 3.1, 0.3)] },
      tail: { kind: 'turn', waves: [w(3.0, 3.9, 0.8), w(0.8, 1.7)] },
    },
    breath: { period: 5.0, sx: 0.012, sy: 0.006, lift: 1.8 },
  },
  // The lion's head and mane, the mane's flowing locks, the goat's head, the snake tail.
  chimere: {
    rigid: ['lion', 'mane', 'goat', 'snake'],
    moves: {
      lion: { kind: 'turn', waves: [w(1.2, 6.1, 0.5), w(0.4, 2.7)] },
      mane: { kind: 'turn', waves: [w(1.5, 4.4, 1.9)] },
      // The goat's head sits against the lion's mane along a long seam: it sways with the lion (the
      // lion's two waves) plus a nod of its own, so the seam never folds; the snake's swing stays clear
      // of the goat's beard (both checked at 3x, the dragon-rig skill's foe notes).
      goat: { kind: 'turn', waves: [w(1.2, 6.1, 0.5), w(0.4, 2.7), w(0.8, 5.2, 2.8)] },
      snake: { kind: 'turn', waves: [w(2.0, 3.6, 0.2), w(0.6, 1.8, 1.0)] },
    },
    breath: { period: 4.6, sx: 0.016, sy: 0.008, lift: 2.4 },
  },
  // The two ghost copies drift a little, apart; her hair on both sides.
  echo: {
    rigid: ['ghostL', 'ghostR', 'hairL', 'hairR'],
    moves: {
      ghostL: { kind: 'drift', x: [w(5, 7.3)], y: [w(5, 5.1, 1.2)] },
      ghostR: { kind: 'drift', x: [w(-5, 6.7, 1.9)], y: [w(5, 5.9, 0.4)] },
      hairL: { kind: 'turn', waves: [w(2.0, 4.3, 0.6)] },
      hairR: { kind: 'turn', waves: [w(-2.0, 4.9, 1.8)] },
    },
    breath: { period: 5.2, sx: 0.01, sy: 0.006, lift: 1.6 },
  },
  // The river's ribbons of hair and robe flow: the two outer bands, the robe between them, the long hair.
  lethe: {
    rigid: ['ribbonL', 'ribbonR', 'robe', 'hair'],
    moves: {
      ribbonL: { kind: 'turn', waves: [w(1.2, 6.4), w(0.4, 2.9, 1.3)] },
      ribbonR: { kind: 'turn', waves: [w(-1.2, 5.8, 1.6), w(0.4, 2.5)] },
      robe: { kind: 'drift', x: [w(3, 7.1, 0.7)], y: [] },
      hair: { kind: 'turn', waves: [w(1.0, 4.6, 2.2)] },
    },
    breath: { period: 5.4, sx: 0.01, sy: 0.006, lift: 1.6 },
  },
  // The tentacle arm, the beard, the waves at his base; the trident has no weight at all (it stays steady).
  protee: {
    rigid: ['tentacle', 'beard', 'waveL', 'waveR'],
    moves: {
      tentacle: { kind: 'turn', waves: [w(1.2, 4.2, 0.3), w(0.4, 1.9)] },
      beard: { kind: 'turn', waves: [w(1.8, 5.6, 1.1)] },
      waveL: { kind: 'drift', x: [w(4, 3.4)], y: [w(2, 2.3, 1.0)] },
      waveR: { kind: 'drift', x: [w(-4, 3.8, 1.5)], y: [w(2, 2.7, 0.2)] },
    },
    breath: { period: 5.0, sx: 0.012, sy: 0.006, lift: 2.0 },
  },
  // The three sisters' wings in four bones: the left sister's outer and inner wings, the middle
  // sister's, the right sister's.
  sirenes: {
    rigid: ['wingL', 'wingInner', 'wingC', 'wingR'],
    moves: {
      // The wings hang beside the still rock and lie against the sisters' bodies along long seams: a
      // degree is enough (their tips sit 500 px below the shoulders). The middle and right wings touch
      // along one seam, so the right one sways with the middle one plus a beat of its own (checked at
      // 3x, the dragon-rig skill's foe notes).
      wingL: { kind: 'turn', waves: [w(1.0, 4.6)] },
      wingInner: { kind: 'turn', waves: [w(-0.8, 5.2, 0.8)] },
      wingC: { kind: 'turn', waves: [w(0.9, 4.9, 1.9)] },
      wingR: { kind: 'turn', waves: [w(0.9, 4.9, 1.9), w(-0.4, 5.5, 2.7)] },
    },
    breath: { period: 4.4, sx: 0.012, sy: 0.006, lift: 1.8 },
  },
};

/** The game's own pictures (the battle's `opponent.art`, Éris's routed one). */
export const FOE_SPRITES: Record<FoeRig, string> = {
  eris: ART.eris,
  eris_flustered: ART.erisFlustered,
  hydre: ART.lieutenants.hydre,
  chimere: ART.lieutenants.chimere,
  echo: ART.lieutenants.echo,
  lethe: ART.lieutenants.lethe,
  protee: ART.lieutenants.protee,
  sirenes: ART.lieutenants.sirenes,
};
