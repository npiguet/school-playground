import { describe, expect, it } from 'vitest';
import { matchRoute } from '../routes';
import { placeFor, sceneHref } from './places';

const at = (hash: string) => placeFor(matchRoute(hash));

describe('places (UI3 Ruling A1: every legacy route is its place plus an overlay)', () => {
  it('shows the title for the hero routes', () => {
    expect(at('#/')).toEqual({ place: 'title', panel: null });
    expect(at('#/?panel=tous')).toEqual({ place: 'title', panel: 'tous' });
    expect(at('#/profiles/new')).toEqual({ place: 'title', panel: 'nouveau' });
  });

  it('shows the camp, with its hero panel', () => {
    expect(at('#/p/3/camp')).toEqual({ place: 'camp', panel: null });
    expect(at('#/p/3/camp?panel=heros')).toEqual({ place: 'camp', panel: 'heros' });
    expect(at('#/p/3/camp?panel=nope')).toEqual({ place: 'camp', panel: null });
  });

  it('opens the library tent and its four objects', () => {
    expect(at('#/p/3/tente-parchemins')).toEqual({ place: 'library', panel: null });
    expect(at('#/p/3/parchemins')).toEqual({ place: 'library', panel: 'etageres' });
    expect(at('#/p/3/texts/new')).toEqual({ place: 'library', panel: 'pupitre' });
    expect(at('#/p/3/texts/scan')).toEqual({ place: 'library', panel: 'loupe' });
    expect(at('#/p/3/alexandria')).toEqual({ place: 'library', panel: 'portail' });
    expect(at('#/p/3/alexandria/verne')).toEqual({ place: 'library', panel: 'oeuvre' });
  });

  it('opens Delphi, the Pythia and the votive tablets', () => {
    expect(at('#/p/3/temple')).toEqual({ place: 'delphi', panel: null });
    expect(at('#/p/3/delphes')).toEqual({ place: 'delphi', panel: 'pythie' });
    expect(at('#/p/3/quetes')).toEqual({ place: 'delphi', panel: 'tablettes' });
  });

  it('leaves the battle routes and the places UI3b builds to their current screens', () => {
    for (const h of ['#/p/3/play/1', '#/p/3/grimoire/1', '#/p/3/eris', '#/p/3/dossier', '#/p/3/dragon', '#/p/3/cabane', '#/p/3/stats']) {
      expect(at(h), h).toBeNull();
    }
  });

  it('knows the bare scene an overlay closes onto', () => {
    expect(sceneHref('title', 3)).toBe('#/');
    expect(sceneHref('camp', 3)).toBe('#/p/3/camp');
    expect(sceneHref('library', 3)).toBe('#/p/3/tente-parchemins');
    expect(sceneHref('delphi', 3)).toBe('#/p/3/temple');
  });
});
