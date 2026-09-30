import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState } from '../types';
import { LIEUTENANT_NAMES, WAR_HOTSPOTS, WAR_SCENE, isLieutenantKey } from './war';

const lt = (key: string, over: Partial<LieutenantState> = {}) =>
  ({ key, name: key, available: true, neutralised: false, active_quest_id: null, ...over }) as LieutenantState;
const state = (id: string, lieutenants: LieutenantState[]) =>
  WAR_HOTSPOTS.find((h) => h.id === id)!.state({ camp: { lieutenants } as CampResponse, catalog: null });

describe('war tent (UI3 Ruling B4)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(WAR_SCENE)).toEqual([]);
    expect(WAR_SCENE).toMatchObject({ id: 'war', title: 'La tente de guerre', background: '/art/scenes/war_tent.webp' });
    expect(WAR_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
  });

  it('pins the six lieutenants to their sheets, the file to the map table, the codex to the lectern', () => {
    expect(WAR_HOTSPOTS.map((h) => [h.id, h.target, h.params?.key ?? null, h.labelPos])).toEqual([
      ['hydre', 'lieutenant', 'hydre', 'on'],
      ['echo', 'lieutenant', 'echo', 'on'],
      ['chimere', 'lieutenant', 'chimere', 'on'],
      ['protee', 'lieutenant', 'protee', 'on'],
      ['sirenes', 'lieutenant', 'sirenes', 'on'],
      ['lethe', 'lieutenant', 'lethe', 'on'],
      ['dossier', 'dossier', null, 'above'],
      ['bestiary', 'bestiaire', null, 'above'],
    ]);
    expect(WAR_HOTSPOTS.map((h) => h.label).slice(-2)).toEqual(["Le dossier d'Éris", 'Le bestiaire']);
    expect(LIEUTENANT_NAMES.protee).toBe('Protée');
    expect([isLieutenantKey('echo'), isLieutenantKey('eris')]).toEqual([true, false]);
  });

  it('locks a sleeping lieutenant, inks a foiled one, marks a quest', () => {
    expect(state('protee', [lt('protee', { available: false })])).toMatchObject({ locked: true, caption: 'Dort encore' });
    expect(state('sirenes', [lt('sirenes', { available: false })])).toMatchObject({ locked: true, caption: 'Dorment encore' });
    expect(state('hydre', [lt('hydre', { neutralised: true })])).toMatchObject({ caption: 'Neutralisée' });
    expect(state('protee', [lt('protee', { neutralised: true })])).toMatchObject({ caption: 'Neutralisé' });
    expect(state('chimere', [lt('chimere', { active_quest_id: 4 })])).toMatchObject({ caption: 'Quête en cours' });
  });
});
