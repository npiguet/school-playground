import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState } from '../types';
import { LIEUTENANT_NAMES, WAR_HOTSPOTS, WAR_SCENE, isLieutenantKey } from './war';

const lt = (key: string, over: Partial<LieutenantState> = {}) =>
  ({ key, name: key, available: true, level: 0, level_reached_at: null, next: null, active_quest_id: null, ...over }) as LieutenantState;
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

  it('locks a sleeping lieutenant, marks a quest', () => {
    expect(state('protee', [lt('protee', { available: false })])).toMatchObject({ locked: true, caption: 'Dort encore' });
    expect(state('sirenes', [lt('sirenes', { available: false })])).toMatchObject({ locked: true, caption: 'Dorment encore' });
    expect(state('chimere', [lt('chimere', { active_quest_id: 4 })])).toMatchObject({ caption: 'Quête en cours' });
  });

  it('captions a sealed sheet with its seal (spec 2026-09-29 lieutenant levels §5)', () => {
    const sealed = (level: number) => state('hydre', [lt('hydre', { level })]);
    expect(sealed(2).caption).toBe('Sceau de bronze');
    expect(sealed(5).caption).toBe("Sceau d'orichalque");
    expect(sealed(0).caption).toBeNull();
  });

  it('says a sealed lieutenant on a quest is on a quest (its pinned trophy already shows the seal)', () => {
    expect(state('hydre', [lt('hydre', { level: 2, active_quest_id: 7 })])).toMatchObject({ caption: 'Quête en cours' });
  });
});
