// Delphi (scenes UI spec §3 "Delphi scene"): the Pythia on her tripod (the weekly scrolls and the
// prophecies) and the votive-tablet wall (the quests). Each opens its legacy route as an overlay
// (UI3 Ruling A1). The Pythia greets with a static line (A9).
import { ART } from '../art';
import type { CampResponse, ScrollKey } from '../types';
import { st, type DialogueLine, type HotspotDef, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { DELPHI_SHAPES } from './delphi.shapes';
import { nextStep } from '../nextStep';
import { nearestProphecy, prophecyWhen } from '../prophecy';

export const DELPHI_HOTSPOTS: HotspotDef[] = [
  {
    id: 'pythia',
    label: 'La Pythie',
    target: 'oracle',
    shape: DELPHI_SHAPES.pythia,
    labelPos: 'above',
    leader: true,
    // Ruling B9: the Pythia glows only when the game's next step is hers (a near prophecy, or the
    // week's sealed scrolls); her caption says what waits here either way. UI3b playability #9: on a
    // near prophecy it says what the hub's plaque promised, in the same words (camp.ts campNews).
    state: ({ camp }) => {
      if (!camp) return st();
      const step = nextStep(camp);
      const glow = step === 'prophecy' || step === 'scrolls';
      if (step === 'prophecy') return st({ isNew: true, caption: `Une prophétie, ${prophecyWhen(nearestProphecy(camp)!.days_left)}` });
      return camp.oracle.status === 'sealed' ? st({ isNew: glow, caption: 'Trois rouleaux à ouvrir' }) : st({ isNew: glow, caption: 'Quête en cours' });
    },
  },
  {
    id: 'tablets',
    label: 'Le mur des quêtes',
    target: 'quests',
    shape: DELPHI_SHAPES.tablets,
    // Playability #16: the plaque hangs on the wall above the tablets, never on the altar below.
    labelPos: 'above',
    leader: true,
    state: ({ camp }) => {
      const n = camp?.quests.filter((q) => q.status === 'active').length ?? 0;
      return st({ badge: n > 0 ? n : null });
    },
  },
];

/** The Pythia seated where the painted tripod stands (docs/art/scenes.md: centred at x 32.5, feet
 *  at about y 76, about half the picture's height: 16 % wide for the 768×1344 cut-out). */
export const PYTHIA_LAYER: SceneLayerDef = {
  id: 'pythia',
  src: ART.characters.pythia,
  alt: '',
  x: 32.5,
  y: 77,
  scale: 16,
  depth: 1,
  idle: 'breathe',
};

export const DELPHI_SCENE: SceneDef = {
  id: 'delphi',
  title: 'Le temple de Delphes',
  background: ART.scenes.delphi,
  layers: [PYTHIA_LAYER],
  hotspots: DELPHI_HOTSPOTS,
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'delphi.enter', firstVisit: 'delphi.first' },
  // The only way out is the camp: warm it for a deep link or a reload into the temple (final review M8).
  preload: [ART.scenes.hubCamp],
};

export function pythiaGreeting(camp: CampResponse): DialogueLine[] {
  const text =
    camp.oracle.status === 'sealed'
      ? "Approche. Trois rouleaux scellés t'attendent cette semaine."
      : "La quête de la semaine est choisie. L'Oracle parlera de nouveau lundi.";
  return [{ speaker: 'pythia', name: 'La Pythie', portrait: ART.characters.pythia, text }];
}

/** Carry #13 / Ruling A10: the server calls the school scroll « Ce qui arrive à l'école ». */
export function scrollTitle(key: ScrollKey, title: string): string {
  return key === 'ecole' ? 'Ce que prépare ta classe' : title;
}
