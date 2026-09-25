// A character's line inside an overlay (immersion wave Ruling W2): the old instruction paragraphs,
// spoken by the place's character from the top of the panel (OverlayVoice.svelte). Static lines,
// UI3 Ruling A9's precedent; the dialogue content files are UI5.
import { ART } from './art';
import type { DialogueLine } from '../scene/types';

const owl = (text: string): DialogueLine => ({ speaker: 'owl', name: "La chouette d'Athéna", portrait: ART.characters.owl, text });
const pythia = (text: string): DialogueLine => ({ speaker: 'pythia', name: 'La Pythie', portrait: ART.characters.pythia, text });

export const VOICES = {
  ritual: owl('Hou ! Écris ton prénom sur la bannière, choisis ton emblème, et ton bouclier rejoindra la porte du camp.'),
  shelves: owl("Hou ! Choisis un parchemin à protéger des dés-accords d'Éris."),
  desk: owl('Hou ! Entre 80 et 200 mots, et les nombres en lettres, sinon Éris triche.'),
  lens: owl("Hou ! Pose la feuille imprimée bien à plat, en pleine lumière : une photo par page. L'écriture à la main, je ne sais pas la lire."),
  portal: owl('Hou ! Choisis une œuvre, puis un rouleau à poser sur tes étagères.'),
  pythia: pythia("Un seul rouleau s'ouvre chaque semaine, et les trois promettent la même récompense. Choisis celui qui t'appelle."),
} as const satisfies Record<string, DialogueLine>;
