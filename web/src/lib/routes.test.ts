import { describe, it, expect } from 'vitest';
import { matchRoute, href } from './routes';

describe('matchRoute', () => {
  it('matches every screen', () => {
    expect(matchRoute('')).toEqual({ name: 'profiles', params: {} });
    expect(matchRoute('#/')).toEqual({ name: 'profiles', params: {} });
    expect(matchRoute('#/profiles/new')).toEqual({ name: 'profile-new', params: {} });
    expect(matchRoute('#/p/3/camp')).toEqual({ name: 'library', params: { profileId: '3' } });
    expect(matchRoute('#/p/3/texts/new')).toEqual({ name: 'text-new', params: { profileId: '3' } });
    expect(matchRoute('#/p/3/play/12')).toEqual({ name: 'play', params: { profileId: '3', textId: '12' } });
    expect(matchRoute('#/p/3/stats')).toEqual({ name: 'stats', params: { profileId: '3' } });
    expect(matchRoute('#/p/3/settings')).toEqual({ name: 'settings', params: { profileId: '3' } });
    expect(matchRoute('#/nope/zzz')).toEqual({ name: 'profiles', params: {} });
  });
  it('builds hrefs', () => {
    expect(href('play', { profileId: '3', textId: '12' })).toBe('#/p/3/play/12');
    expect(href('profiles')).toBe('#/');
  });
});
