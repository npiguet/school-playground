// Which place (scene) a route shows and which overlay is open on it (scenes UI spec §2.2-2.3,
// UI3 Ruling A1). Every legacy route keeps working: it becomes "its place + its overlay", so
// selectors, deep links, reload and Back behave as before. Routes that return null still render
// their legacy screen (the battle routes, until UI4).
import { href, type Route } from '../routes';

export type PlaceId = 'title' | 'camp' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin';

export type PanelId =
  | 'tous'
  | 'nouveau'
  | 'heros'
  | 'etageres'
  | 'pupitre'
  | 'loupe'
  | 'portail'
  | 'oeuvre'
  | 'pythie'
  | 'tablettes'
  | 'dossier'
  | 'codex'
  | 'page'
  | 'portrait'
  | 'soin'
  | 'tresors'
  | 'journal'
  | 'lyre';

/** Every overlay's title (Ruling W6): a place hotspot's plaque starts its overlay's title, so the
 *  player opens what she tapped (carry #12, playability #15). One table, read by every place. */
export const OVERLAY_TITLES: Record<PanelId, string> = {
  tous: 'Tous les héros',
  nouveau: 'Forge ton bouclier',
  heros: 'Ton héros',
  etageres: 'Tes parchemins',
  pupitre: 'Le pupitre',
  loupe: 'La lentille de bronze',
  portail: "Le portail d'Alexandrie",
  oeuvre: "Le portail d'Alexandrie",
  pythie: 'La Pythie',
  tablettes: 'Le mur des quêtes',
  dossier: "Le dossier d'Éris",
  codex: 'Le bestiaire',
  // `page` and `portrait` are titled by the entry / the lieutenant itself: these are the fallbacks
  // for an unknown key (UI3 Ruling B1).
  page: 'Le bestiaire',
  portrait: "Les lieutenants d'Éris",
  soin: 'Ton dragon',
  tresors: 'Tes trésors',
  journal: 'Ton journal',
  lyre: 'La lyre',
};

export interface PlaceView {
  place: PlaceId;
  panel: PanelId | null;
}

export function placeFor(route: Route): PlaceView | null {
  switch (route.name) {
    case 'profiles':
      return { place: 'title', panel: route.query.panel === 'tous' ? 'tous' : null };
    case 'profile-new':
      return { place: 'title', panel: 'nouveau' };
    case 'camp':
      return { place: 'camp', panel: route.query.panel === 'heros' ? 'heros' : null };
    case 'library-tent':
      return { place: 'library', panel: null };
    case 'library':
      return { place: 'library', panel: 'etageres' };
    case 'text-new':
      return { place: 'library', panel: 'pupitre' };
    case 'text-scan':
      return { place: 'library', panel: 'loupe' };
    case 'alexandria':
      return { place: 'library', panel: 'portail' };
    case 'alexandria-work':
      return { place: 'library', panel: 'oeuvre' };
    case 'delphi':
      return { place: 'delphi', panel: null };
    case 'oracle':
      return { place: 'delphi', panel: 'pythie' };
    case 'quests':
      return { place: 'delphi', panel: 'tablettes' };
    case 'war-tent':
      return { place: 'war', panel: null };
    case 'dossier':
      return { place: 'war', panel: 'dossier' };
    case 'bestiaire':
      return { place: 'war', panel: 'codex' };
    case 'bestiaire-entry':
      return { place: 'war', panel: 'page' };
    case 'lieutenant':
      return { place: 'war', panel: 'portrait' };
    case 'dragon':
      return { place: 'nest', panel: route.query.panel === 'soin' ? 'soin' : null };
    case 'cabin': {
      const p = route.query.panel;
      return { place: 'cabin', panel: p === 'tresors' || p === 'heros' ? p : null };
    }
    case 'stats':
      return { place: 'cabin', panel: 'journal' };
    case 'settings':
      return { place: 'cabin', panel: 'lyre' };
    default:
      return null;
  }
}

/** The bare scene of a place: where closing one of its overlays lands (Ruling A2). */
export function sceneHref(place: PlaceId, profileId: number): string {
  const p = { profileId: String(profileId) };
  switch (place) {
    case 'title':
      return href('profiles');
    case 'camp':
      return href('camp', p);
    case 'library':
      return href('library-tent', p);
    case 'delphi':
      return href('delphi', p);
    case 'war':
      return href('war-tent', p);
    case 'nest':
      return href('dragon', p);
    case 'cabin':
      return href('cabin', p);
  }
}
