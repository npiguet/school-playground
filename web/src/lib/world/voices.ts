// A character's line inside an overlay (immersion wave Ruling W2): the old instruction paragraphs,
// spoken by the place's character from the top of the panel (OverlayVoice.svelte). Static lines,
// UI3 Ruling A9's precedent; the dialogue content files are UI5.
import { ART } from './art';
import type { DialogueLine } from '../scene/types';

export const owl = (text: string): DialogueLine => ({ speaker: 'owl', name: "La chouette d'Athéna", portrait: ART.characters.owl, text });
export const pythia = (text: string): DialogueLine => ({ speaker: 'pythia', name: 'La Pythie', portrait: ART.characters.pythia, text });

/** Éris speaks in her war tent (UI3 Ruling B10): lines built from live data (her dossier lines). */
export function erisSays(text: string): DialogueLine {
  return { speaker: 'eris', name: 'Éris', portrait: ART.erisSmug, text };
}

export const VOICES = {
  ritual: owl('Hou\u202f! Écris ton prénom sur la bannière, choisis ton emblème, et ton bouclier rejoindra la porte du camp.'),
  shelves: owl("Hou\u202f! Choisis un parchemin à protéger des dés-accords d'Éris."),
  desk: owl("Hou\u202f! Entre 80 et 200 mots, c'est l'idéal, et les nombres en lettres."),
  lens: owl("Hou\u202f! Pose la feuille imprimée bien à plat, en pleine lumière\u202f: une photo par page. L'écriture à la main, je ne sais pas la lire."),
  portal: owl('Hou\u202f! Choisis une œuvre, puis un rouleau à poser sur tes étagères.'),
  // Re-review N11: the empty right page of a work never copied (PortalWorkPanel).
  scribesEmpty: owl("Hou\u202f! Les scribes n'ont encore rien recopié de ce livre. Demande-leur\u202f!"),
  // Once the week's scroll is open, her line no longer asks for a choice (re-review walk a15b).
  pythiaChosen: pythia("Le rouleau de la semaine est ouvert, et sa quête t'attend. Défends aussi mes prophéties avant leur jour."),
  pythia: pythia("Un seul rouleau s'ouvre chaque semaine, et les trois promettent la même récompense. Choisis celui qui t'appelle."),
  // Re-review N13: the quest wall's voice; TabletsPanel speaks it with the live reward and treasure.
  wall: pythia('Chaque monstre défié rapporte de la gloire et une page du bestiaire.'),
  // UI3b: the owl keeps the bestiary (the old subtitle, immersion Ruling W2).
  bestiary: owl("Hou\u202f! Chaque page raconte d'abord le vrai mythe. Ce que le camp en a fait est écrit à part, sous «\u202fAu camp\u202f»."),
} as const satisfies Record<string, DialogueLine>;
