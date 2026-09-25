// The library tent (scenes UI spec §3 "Library scene"): shelves = her texts, the scribe's desk =
// write or paste a text, the bronze lens = scan a sheet, the portal = Alexandria. Each object opens
// its legacy route as an overlay (UI3 Ruling A1); the three ways in replace the old add menu (A16).
import { ADD_ICONS, ART } from '../art';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { LIBRARY_SHAPES } from './library.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const LIBRARY_HOTSPOTS: HotspotDef[] = [
  {
    id: 'shelves',
    label: 'Tes parchemins',
    target: 'library',
    shape: LIBRARY_SHAPES.shelves,
    labelPos: 'above',
    leader: true,
    state: ({ camp }) => (camp !== null && camp.xp.total === 0 ? st({ isNew: true, caption: 'Choisis un texte à défendre' }) : st()),
  },
  {
    id: 'desk',
    label: 'Le pupitre',
    target: 'text-new',
    icon: ADD_ICONS.text,
    shape: LIBRARY_SHAPES.desk,
    labelPos: 'above',
    leader: true,
    state: () => st({ caption: 'Taper ou coller un texte' }),
  },
  {
    id: 'lens',
    label: 'La lentille',
    target: 'text-scan',
    icon: ADD_ICONS.scan,
    shape: LIBRARY_SHAPES.lens,
    labelPos: 'below',
    leader: true,
    state: () => st({ caption: 'Scanner une feuille' }),
  },
  {
    id: 'portal',
    label: 'Le portail',
    target: 'alexandria',
    icon: ADD_ICONS.alexandria,
    shape: LIBRARY_SHAPES.portal,
    labelPos: 'below',
    leader: true,
    state: () => st({ caption: 'Des textes classiques' }),
  },
];

/** Athena's owl perched on the right-hand side table (docs/art/scenes.md: ≈ (80, 45), 14 % of the
 *  height; feet on the table top at y 58). Decorative: it speaks through the DialogueBox. */
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
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'library.enter', firstVisit: 'library.first' },
  // The only way out is the camp: warm it for a deep link or a reload into the tent (final review M8).
  preload: [ART.scenes.camp],
};

/** UI3 Ruling A9: the owl's static line (dialogue content files are UI5). */
export function owlGreeting(): DialogueLine[] {
  return [
    {
      speaker: 'owl',
      name: "La chouette d'Athéna",
      portrait: ART.characters.owl,
      text: 'Hou ! Tes parchemins dorment sur les étagères. Le pupitre, la lentille et le portail en apportent de nouveaux.',
    },
  ];
}
