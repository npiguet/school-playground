import { describe, it, expect } from 'vitest';
import { matchRoute, href } from './routes';

describe('matchRoute', () => {
  it('matches every screen', () => {
    expect(matchRoute('')).toEqual({ name: 'profiles', params: {}, query: {} });
    expect(matchRoute('#/')).toEqual({ name: 'profiles', params: {}, query: {} });
    expect(matchRoute('#/profiles/new')).toEqual({ name: 'profile-new', params: {}, query: {} });
    expect(matchRoute('#/p/3/camp')).toEqual({ name: 'camp', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/parchemins')).toEqual({ name: 'library', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/texts/new')).toEqual({ name: 'text-new', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/texts/scan')).toEqual({ name: 'text-scan', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/grimoire/12')).toEqual({
      name: 'grimoire',
      params: { profileId: '3', textId: '12' },
      query: {},
    });
    expect(matchRoute('#/p/3/alexandria')).toEqual({ name: 'alexandria', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/alexandria/verne-tour-du-monde')).toEqual({
      name: 'alexandria-work',
      params: { profileId: '3', workId: 'verne-tour-du-monde' },
      query: {},
    });
    expect(matchRoute('#/p/3/play/12')).toEqual({ name: 'play', params: { profileId: '3', textId: '12' }, query: {} });
    expect(matchRoute('#/p/3/play/12?quest=7&encounter=eris&help=3')).toEqual({
      name: 'play',
      params: { profileId: '3', textId: '12' },
      query: { quest: '7', encounter: 'eris', help: '3' },
    });
    expect(matchRoute('#/p/3/stats')).toEqual({ name: 'stats', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/settings')).toEqual({ name: 'settings', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/dossier')).toEqual({ name: 'dossier', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/bestiaire')).toEqual({ name: 'bestiaire', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/bestiaire/echo')).toEqual({
      name: 'bestiaire-entry',
      params: { profileId: '3', key: 'echo' },
      query: {},
    });
    expect(matchRoute('#/p/3/monstres/hydre')).toEqual({
      name: 'lieutenant',
      params: { profileId: '3', key: 'hydre' },
      query: {},
    });
    expect(matchRoute('#/p/3/delphes')).toEqual({ name: 'oracle', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/quetes')).toEqual({ name: 'quests', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/eris')).toEqual({ name: 'boss', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/dragon')).toEqual({ name: 'dragon', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/p/3/cabane')).toEqual({ name: 'cabin', params: { profileId: '3' }, query: {} });
    expect(matchRoute('#/nope/zzz')).toEqual({ name: 'profiles', params: {}, query: {} });
  });

  it('builds hrefs', () => {
    expect(href('play', { profileId: '3', textId: '12' })).toBe('#/p/3/play/12');
    expect(href('play', { profileId: '3', textId: '12' }, { quest: '7' })).toBe('#/p/3/play/12?quest=7');
    expect(href('profiles')).toBe('#/');
    expect(href('camp', { profileId: '3' })).toBe('#/p/3/camp');
    expect(href('text-scan', { profileId: '3' })).toBe('#/p/3/texts/scan');
    expect(href('grimoire', { profileId: '3', textId: '12' })).toBe('#/p/3/grimoire/12');
    expect(href('alexandria', { profileId: '3' })).toBe('#/p/3/alexandria');
    expect(href('alexandria-work', { profileId: '3', workId: 'verne-tour-du-monde' })).toBe(
      '#/p/3/alexandria/verne-tour-du-monde',
    );
    expect(href('library', { profileId: '3' })).toBe('#/p/3/parchemins');
    expect(href('bestiaire-entry', { profileId: '3', key: 'echo' })).toBe('#/p/3/bestiaire/echo');
    expect(href('lieutenant', { profileId: '3', key: 'hydre' })).toBe('#/p/3/monstres/hydre');
    expect(href('oracle', { profileId: '3' })).toBe('#/p/3/delphes');
    expect(href('quests', { profileId: '3' })).toBe('#/p/3/quetes');
    expect(href('boss', { profileId: '3' })).toBe('#/p/3/eris');
    expect(href('dragon', { profileId: '3' })).toBe('#/p/3/dragon');
    expect(href('cabin', { profileId: '3' })).toBe('#/p/3/cabane');
  });
});
