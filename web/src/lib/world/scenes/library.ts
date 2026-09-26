// The library tent (scenes UI spec §3 "Library scene"): shelves = her texts, the scribe's desk =
// write or paste a text, the bronze lens = scan a sheet, the portal = Alexandria. Each object opens
// its legacy route as an overlay (UI3 Ruling A1); the three ways in replace the old add menu (A16).
// Athena's owl is a fifth, plaque-less hotspot: a tap makes her speak (immersion wave, #23).
import { SCENE_MUSIC } from '../../audio/catalog';
import { ADD_ICONS, ART, PLACE_ICONS } from '../art';
import { st, type DialogueLine, type HotspotDef, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { LIBRARY_SHAPES } from './library.shapes';
import { nextStep } from '../nextStep';
import { sayKey } from '../../dialogue/select';

export const LIBRARY_HOTSPOTS: HotspotDef[] = [
  {
    id: 'shelves',
    label: 'Tes parchemins',
    target: 'library',
    // Playability #20: every plaque has its icon; the stacked scrolls are the shelves' own.
    icon: ADD_ICONS.alexandria,
    shape: LIBRARY_SHAPES.shelves,
    labelPos: 'above',
    leader: true,
    // Ruling B9: the shelves glow only when a first text is the game's next step; a new hero keeps
    // the caption even while a near prophecy or a battle comes first.
    state: ({ camp }) =>
      st({ isNew: nextStep(camp) === 'first-text', caption: camp !== null && camp.xp.total === 0 ? 'Choisis un texte à défendre' : null }),
  },
  {
    id: 'desk',
    label: 'Le pupitre',
    target: 'text-new',
    icon: ADD_ICONS.text,
    shape: LIBRARY_SHAPES.desk,
    labelPos: 'above',
    leader: true,
    state: () => st({ caption: 'Écrire un nouveau parchemin' }),
  },
  {
    id: 'lens',
    label: 'La lentille',
    target: 'text-scan',
    icon: ADD_ICONS.scan,
    shape: LIBRARY_SHAPES.lens,
    labelPos: 'below',
    leader: true,
    state: () => st({ caption: 'Déchiffrer une feuille' }),
  },
  {
    id: 'portal',
    label: 'Le portail',
    target: 'alexandria',
    icon: PLACE_ICONS.portal,
    shape: LIBRARY_SHAPES.portal,
    labelPos: 'below',
    leader: true,
    state: () => st({ caption: "Les livres d'Alexandrie" }),
  },
  // Playability #23: Athena's owl is a speaker you can tap, not scenery. No plaque (she is the
  // plaque-less character on her side table); a tap replays one of her hints in the dialogue box.
  {
    id: 'owl',
    label: '',
    ariaLabel: "La chouette d'Athéna",
    target: null,
    shape: LIBRARY_SHAPES.owl,
    labelPos: 'above',
    state: () => st(),
  },
];

/** Athena's owl perched on the right-hand side table (docs/art/scenes.md: ≈ (80, 45), 14 % of the
 *  height; feet on the table top at y 58). The `owl` hotspot above makes her tappable; she speaks
 *  through the DialogueBox. */
export const OWL_LAYER: SceneLayerDef = {
  id: 'owl',
  src: ART.characters.owl,
  alt: '',
  x: 80,
  y: 58,
  scale: 8,
  depth: 1,
  idle: 'breathe',
};

export const LIBRARY_SCENE: SceneDef = {
  id: 'library',
  title: 'La tente des parchemins',
  background: ART.scenes.libraryTent,
  layers: [OWL_LAYER],
  hotspots: LIBRARY_HOTSPOTS,
  ambience: { particles: 'dust', music: SCENE_MUSIC.library },
  narrator: { enter: 'library.enter', tour: 'library' },
  // The only way out is the camp: warm it for a deep link or a reload into the tent (final review M8).
  preload: [ART.scenes.hubCamp],
};

/** A random owl hint, never the one she just said (spec §8: the selector remembers the last). */
export function owlHint(): DialogueLine {
  return sayKey('library.owl');
}

/** The owl's greeting (UI3 Ruling A9, UI5 Ruling E12). */
export function owlGreeting(): DialogueLine[] {
  return [sayKey('library.enter')];
}
