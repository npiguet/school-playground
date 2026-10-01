import { describe, expect, it } from 'vitest';
import { matchRoute } from '../routes';
import { OVERLAY_TITLES, placeFor, sceneHref } from './places';
import { SCENES } from './scenes';
import { CAMP_HOTSPOTS } from './scenes/camp';
import { DELPHI_HOTSPOTS } from './scenes/delphi';

const at = (hash: string) => placeFor(matchRoute(hash));

describe('places (UI3 Ruling A1: every legacy route is its place plus an overlay)', () => {
  it('shows the title for the hero routes', () => {
    expect(at('#/')).toEqual({ place: 'title', panel: null });
    expect(at('#/?panel=tous')).toEqual({ place: 'title', panel: 'tous' });
    expect(at('#/profiles/new')).toEqual({ place: 'title', panel: 'nouveau' });
  });

  it("shows the camp, with its hero panel and Hermès's stall (spec 2026-09-29 drachmes §2, R10)", () => {
    expect(at('#/p/3/camp')).toEqual({ place: 'camp', panel: null });
    expect(at('#/p/3/camp?panel=heros')).toEqual({ place: 'camp', panel: 'heros' });
    expect(placeFor(matchRoute('#/p/3/camp?panel=etal'))).toEqual({ place: 'camp', panel: 'etal' });
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

  it('opens the war tent: the map table, the codex, a codex page and the portrait sheets', () => {
    expect(at('#/p/3/tente-de-guerre')).toEqual({ place: 'war', panel: null });
    expect(at('#/p/3/dossier')).toEqual({ place: 'war', panel: 'dossier' });
    expect(at('#/p/3/bestiaire')).toEqual({ place: 'war', panel: 'codex' });
    expect(at('#/p/3/bestiaire/echo')).toEqual({ place: 'war', panel: 'page' });
    expect(at('#/p/3/monstres/hydre')).toEqual({ place: 'war', panel: 'portrait' });
  });

  it('opens the nest and the cabin, with their overlays', () => {
    expect(at('#/p/3/dragon')).toEqual({ place: 'nest', panel: null });
    expect(at('#/p/3/dragon?panel=soin')).toEqual({ place: 'nest', panel: 'soin' });
    expect(at('#/p/3/dragon?panel=nope')).toEqual({ place: 'nest', panel: null });
    expect(at('#/p/3/cabane')).toEqual({ place: 'cabin', panel: null });
    expect(at('#/p/3/cabane?panel=tresors')).toEqual({ place: 'cabin', panel: 'tresors' });
    expect(at('#/p/3/cabane?panel=heros')).toEqual({ place: 'cabin', panel: 'heros' });
    expect(at('#/p/3/cabane?panel=guide')).toEqual({ place: 'cabin', panel: 'guide' });
    expect(at('#/p/3/stats')).toEqual({ place: 'cabin', panel: 'journal' });
    expect(at('#/p/3/settings')).toEqual({ place: 'cabin', panel: 'lyre' });
  });

  it('leaves only the battle routes to their legacy screens (UI4)', () => {
    for (const h of ['#/p/3/play/1', '#/p/3/grimoire/1', '#/p/3/eris']) expect(at(h), h).toBeNull();
  });

  it('knows the bare scene an overlay closes onto', () => {
    expect(sceneHref('title', 3)).toBe('#/');
    expect(sceneHref('camp', 3)).toBe('#/p/3/camp');
    expect(sceneHref('library', 3)).toBe('#/p/3/tente-parchemins');
    expect(sceneHref('delphi', 3)).toBe('#/p/3/temple');
    expect(sceneHref('war', 3)).toBe('#/p/3/tente-de-guerre');
    expect(sceneHref('nest', 3)).toBe('#/p/3/dragon');
    expect(sceneHref('cabin', 3)).toBe('#/p/3/cabane');
  });

  it('names every overlay once, echoing the plaque that opens it (carry #12, playability #15, Ruling W6)', () => {
    expect(OVERLAY_TITLES).toEqual({
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
      page: 'Le bestiaire',
      portrait: "Les lieutenants d'Éris",
      soin: 'Ton dragon',
      tresors: 'Tes trésors',
      journal: 'Ton journal',
      lyre: 'La lyre',
      etal: "L'étal d'Hermès",
      guide: 'Le guide du camp',
    });
    expect(OVERLAY_TITLES.etal).toBe("L'étal d'Hermès");
    expect(OVERLAY_TITLES.guide).toBe('Le guide du camp');
    // `portrait` and `page` are titled by the lieutenant / the entry itself (B1); a hotspot that
    // leads to another place (every hub place) names that place, not one of its overlays.
    const DYNAMIC = new Set(['portrait', 'page']);
    for (const scene of SCENES) {
      for (const h of scene.hotspots) {
        if (!h.target || !h.label) continue;
        const view = placeFor({ name: h.target, params: { profileId: '1', workId: 'w', key: 'hydre', ...h.params }, query: h.query ?? {} });
        if (!view?.panel || view.place !== scene.id || DYNAMIC.has(view.panel)) continue;
        const title = OVERLAY_TITLES[view.panel];
        expect(title.startsWith(h.label), `${scene.id}/${h.id}: « ${h.label} » opens « ${title} »`).toBe(true);
      }
    }
  });

  it("the hub's Delphi plaque carries the quest count now that the wall lives in the temple (Ruling B3)", () => {
    expect(CAMP_HOTSPOTS.map((h) => h.id)).not.toContain('quests');
    expect(DELPHI_HOTSPOTS.find((h) => h.id === 'tablets')!.label).toBe(OVERLAY_TITLES.tablettes);
  });
});
