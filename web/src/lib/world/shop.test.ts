import { describe, expect, it } from 'vitest';
import { HOUSE_NAMES, buyLabel, confirmQuestion, houseDecorTitle, houseEmptyLine, drachmeChip, drachmesText, houseLockedLine, kindOfItem, lockedAccessoryLine, purseLine, stallShelves } from './shop';
import type { CampResponse, LieutenantState, ShopCatalog } from './types';

const SLOTS = ['cou', 'queue', 'dos', 'tete'] as const;
const LEVEL = { cou: 2, queue: 3, dos: 4, tete: 5 } as const;
const PRICE = { cou: 40, queue: 60, dos: 90, tete: 130 } as const;
const KEYS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'] as const;
const SHOP: ShopCatalog = {
  slots: [...SLOTS],
  slot_levels: { ...LEVEL },
  draw_order: ['queue', 'dos', 'cou', 'tete'],
  accessories: KEYS.flatMap((k) => SLOTS.map((s) => ({ id: `accessory:${k}-${s}`, item: `${k}-${s}`, lieutenant: k, slot: s, level: LEVEL[s], price: PRICE[s], the: `le ${s} ${k}` }))),
  decor: ['amphore', 'chouette', 'mosaique', 'bouclier'].map((d) => ({ id: `decor:${d}`, price: 50, the: `la ${d}` })),
  houses: [
    { id: 'house:villa', key: 'villa', stage: 'adult', after: null, price: 300, the: 'la villa' },
    { id: 'house:palais', key: 'palais', stage: 'illustre', after: 'house:villa', price: 800, the: 'le palais' },
  ],
};
const NAMES = new Proxy({} as Record<string, { name: string }>, { get: (_t, id: string) => ({ name: `Nom ${id}` }) });
const lt = (key: string, level: number) => ({ key, level }) as unknown as LieutenantState;
const camp = (o: { levels?: Partial<Record<string, number>>; stage?: string; drachmes?: number }) =>
  ({
    lieutenants: KEYS.map((k) => lt(k, o.levels?.[k] ?? 0)),
    dragon: { stage: o.stage ?? 'young' },
    drachmes: o.drachmes ?? 0,
  }) as unknown as CampResponse;

// Spec 2026-09-29 drachmes §1, §2.
describe('the purse and the stall in words', () => {
  it('counts drachmes with thousands grouped, and says the chip and the purse', () => {
    expect([drachmesText(1), drachmesText(40), drachmesText(1117)]).toEqual(['1 drachme', '40 drachmes', '1\u202f117 drachmes']);
    expect(purseLine(254)).toBe('Ta bourse\u202f: 254 drachmes');
    expect([drachmeChip(12), drachmeChip(1)]).toEqual(['+12 drachmes', '+1 drachme']);
    expect(confirmQuestion({ the: 'la couronne de pavots', price: 130 })).toBe('Acheter la couronne de pavots pour 130 drachmes\u202f?');
    // SP4 final review M4: each \u00ab Acheter \u00bb names its piece and its price for a screen reader.
    expect(buyLabel({ the: 'la couronne de pavots', price: 130 })).toBe('Acheter la couronne de pavots pour 130 drachmes');
    expect(HOUSE_NAMES).toEqual({ cabin: 'Ta cabane', villa: 'Ta villa', palais: 'Ton palais' });
    // Task 7 fix round 1: the room's own shelf follows the house.
    expect([houseDecorTitle('cabin'), houseDecorTitle('villa'), houseDecorTitle('palais')]).toEqual(['Objets de la cabane', 'Objets de la villa', 'Objets du palais']);
    expect([houseEmptyLine('cabin'), houseEmptyLine('villa'), houseEmptyLine('palais')]).toEqual([
      'Ta cabane attend ses premiers trésors.',
      'Ta villa attend ses premiers trésors.',
      'Ton palais attend ses premiers trésors.',
    ]);
    expect([kindOfItem('accessory:hydre-cou'), kindOfItem('decor:amphore'), kindOfItem('house:villa')]).toEqual(['accessory', 'decor', 'house']);
  });

  it('says what a locked piece waits for, never a number or « niveau »', () => {
    expect(lockedAccessoryLine('hydre', 2)).toBe("Au sceau de bronze de l'Hydre");
    expect(lockedAccessoryLine('echo', 3)).toBe("Au sceau d'argent d'Écho");
    expect(lockedAccessoryLine('sirenes', 5)).toBe("Au sceau d'orichalque des Sirènes");
    const [villa, palais] = SHOP.houses;
    expect(houseLockedLine(villa, 'young', new Set())).toBe('Quand ton dragon sera adulte.');
    expect(houseLockedLine(palais, 'adult', new Set(['house:villa']))).toBe('Quand ton dragon sera illustre.');
    expect(houseLockedLine(palais, 'illustre', new Set())).toBe('Après la villa.');
    expect(houseLockedLine(palais, 'young', new Set())).toBe('Quand ton dragon sera illustre, après la villa.');
    const stages = ['egg', 'hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const;
    const lines = [
      ...KEYS.flatMap((k) => [1, 2, 3, 4, 5].map((l) => lockedAccessoryLine(k, l))),
      ...SHOP.houses.flatMap((h) => stages.flatMap((st) => [new Set<string>(), new Set(['house:villa'])].map((o) => houseLockedLine(h, st, o)))),
    ];
    for (const line of lines) expect(line).not.toMatch(/\d|niveau/i);
  });

  // Review focus 3.
  it('fills the three shelves: owned, affordable, short, locked; Protée from 8H', () => {
    const owned = new Set(['accessory:hydre-cou']);
    const s = stallShelves(SHOP, NAMES, camp({ levels: { hydre: 3, echo: 2 }, drachmes: 55 }), owned, '7H');
    expect(s.accessories.map((g) => g.lieutenant)).toEqual(['hydre', 'echo', 'chimere', 'sirenes', 'lethe']);
    const hydre = s.accessories[0].items;
    expect(hydre.map((i) => i.state)).toEqual(['owned', 'short', 'locked', 'locked']);
    expect(hydre[0]).toMatchObject({ id: 'accessory:hydre-cou', name: 'Nom accessory:hydre-cou', price: 40, note: 'À toi' });
    expect(hydre[1]).toMatchObject({ state: 'short', note: 'Encore 5 drachmes à gagner.', missing: 5 });
    expect(hydre[2].note).toBe("Au sceau d'or de l'Hydre");
    expect(s.accessories[1].items[0]).toMatchObject({ state: 'on_sale', note: null });
    expect(s.decor.map((i) => i.state)).toEqual(['on_sale', 'on_sale', 'on_sale', 'on_sale']);
    expect(s.houses.map((i) => [i.state, i.note])).toEqual([['locked', 'Quand ton dragon sera adulte.'], ['locked', 'Quand ton dragon sera illustre, après la villa.']]);
    expect(stallShelves(SHOP, NAMES, camp({}), new Set(), '8H').accessories.map((g) => g.lieutenant)).toContain('protee');
    const rich = stallShelves(SHOP, NAMES, camp({ stage: 'illustre', drachmes: 5000 }), new Set(['house:villa']), '10H');
    expect(rich.houses.map((i) => i.state)).toEqual(['owned', 'on_sale']);
    expect(stallShelves(SHOP, NAMES, camp({ drachmes: 0 }), new Set(), '10H').decor[0].note).toBe('Encore 50 drachmes à gagner.');
  });

  // Review focus 3, the edges: a lieutenant exactly at seal 2 sells its collar, not its tail ring;
  // a stage ahead of the XP is the stage; a hero at exactly the price can buy.
  it('sells at the edges: seal 2 exactly, the stored stage, the exact price', () => {
    const s = stallShelves(SHOP, NAMES, camp({ levels: { hydre: 2 }, stage: 'adult', drachmes: 300 }), new Set(), '7H');
    expect(s.accessories[0].items.map((i) => i.state)).toEqual(['on_sale', 'locked', 'locked', 'locked']);
    expect(s.accessories[0].items[1].note).toBe("Au sceau d'argent de l'Hydre");
    expect(s.houses.map((i) => [i.state, i.note])).toEqual([['on_sale', null], ['locked', 'Quand ton dragon sera illustre, après la villa.']]);
    expect(stallShelves(SHOP, NAMES, camp({ stage: 'ancestral', drachmes: 0 }), new Set(), '10H').houses[1].note).toBe('Après la villa.');
    // Protée's seal row written by hand at 7H: nothing of his is shown.
    expect(stallShelves(SHOP, NAMES, camp({ levels: { protee: 5 } }), new Set(), '7H').accessories.some((g) => g.lieutenant === 'protee')).toBe(false);
  });
});
