import { describe, expect, it } from 'vitest';
import { BACKDROPS, FACES, HOME, battleFor, isOpponentId, opponentFor } from './battle';

const lt = (key: string, over: Partial<{ available: boolean; neutralised: boolean }> = {}) => ({
  key,
  available: true,
  neutralised: false,
  ...over,
});
const SIX = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'].map((k) => lt(k));

describe('who fights where (Ruling C2)', () => {
  it('sends Éris to the boss fight and to an eris encounter, in her lair', () => {
    expect(opponentFor({ mode: 'boss', encounter: null, textId: 4, lieutenants: SIX })).toBe('eris');
    expect(opponentFor({ mode: 'dictation', encounter: 'eris', textId: 4, lieutenants: SIX })).toBe('eris');
    expect(battleFor('eris', { mode: 'boss', encounter: 'eris' }).backdrop.id).toBe('lair');
    expect(battleFor('eris', { mode: 'grimoire', encounter: 'eris' }).backdrop.id).toBe('lair');
  });

  it('brings the quest lieutenant to its own ground', () => {
    expect(opponentFor({ mode: 'dictation', encounter: 'sirenes', textId: 1, lieutenants: SIX })).toBe('sirenes');
    expect(battleFor('sirenes', { mode: 'dictation', encounter: 'sirenes' }).backdrop.id).toBe('coast');
    expect(HOME).toEqual({ hydre: 'river', lethe: 'river', sirenes: 'coast', protee: 'coast', echo: 'temple', chimere: 'temple' });
  });

  it('lets Éris guard her own grimoire, in the ruined temple', () => {
    expect(opponentFor({ mode: 'grimoire', encounter: null, textId: 9, lieutenants: SIX })).toBe('eris');
    expect(battleFor('eris', { mode: 'grimoire', encounter: null }).backdrop.id).toBe('temple');
  });

  it('picks a free text its lieutenant: awake and not neutralised, stable per text', () => {
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 7, lieutenants: SIX })).toBe('echo'); // 7 % 6 = 1
    const calm = [lt('hydre', { neutralised: true }), lt('echo', { available: false }), lt('chimere'), lt('lethe')];
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: calm })).toBe('lethe'); // 3 % 2 = 1
    expect(opponentFor({ mode: 'dictation', encounter: null, textId: 3, lieutenants: [] })).toBe('eris');
    // Every lieutenant asleep or neutralised as if there were none.
    const spent = [lt('hydre', { neutralised: true }), lt('echo', { available: false }), lt('lethe', { neutralised: true })];
    for (const textId of [0, 1, 2, 3]) {
      expect(opponentFor({ mode: 'dictation', encounter: null, textId, lieutenants: spent })).toBe('eris');
    }
    expect(opponentFor({ mode: 'dictation', encounter: 'nope', textId: 0, lieutenants: SIX })).toBe('hydre');
  });

  it('describes a battle from the existing art only', () => {
    expect(battleFor('hydre', { mode: 'dictation', encounter: null })).toMatchObject({
      opponent: { id: 'hydre', name: "L'Hydre", art: '/art/lieutenants/hydre_cut.webp' },
      backdrop: { id: 'river', src: '/art/scenes/battle_river.webp' },
      ambience: { music: 'battle' },
      narrator: { start: 'battle.start', victory: 'battle.victory' },
    });
    expect(battleFor('eris', { mode: 'boss', encounter: 'eris' }).opponent.art).toBe('/art/characters/eris_cut.webp');
    expect(battleFor('eris', { mode: 'boss', encounter: 'eris' }).ambience.music).toBe('lair');
    expect(Object.keys(BACKDROPS).sort()).toEqual(['coast', 'lair', 'river', 'temple']);
    expect(Object.keys(FACES).sort()).toEqual(['chimere', 'dragon', 'echo', 'eris', 'hydre', 'lethe', 'protee', 'sirenes']);
    expect(isOpponentId('lethe') && isOpponentId('eris') && !isOpponentId('argus')).toBe(true);
  });

  it('knows which way each painted cut-out looks, the dragon per stage (Ruling C10)', () => {
    // Checked by eye on web/public/art (UI4 Task 1). The dragon's stages disagree: the hatchling and
    // the young dragon look right, the adult left; the egg is symmetric.
    expect(FACES.dragon).toEqual({ egg: 'right', hatchling: 'right', young: 'right', adult: 'left' });
    expect(FACES.hydre).toBe('right');
    expect(FACES.eris).toBe('left');
  });
});
