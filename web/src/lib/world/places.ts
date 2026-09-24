// Which place (scene) a route shows and which overlay is open on it (scenes UI spec §2.2-2.3,
// UI3 Ruling A1). Every legacy route keeps working: it becomes "its place + its overlay", so
// selectors, deep links, reload and Back behave as before. Routes that return null still render
// their legacy screen (the battle routes until UI4; dossier, dragon, cabin... until UI3b).
import { href, type Route } from '../routes';

export type PlaceId = 'title' | 'camp' | 'library' | 'delphi';

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
  | 'tablettes';

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
  }
}
