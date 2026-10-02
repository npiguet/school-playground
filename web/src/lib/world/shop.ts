// Hermès's stall in words (spec 2026-09-29 drachmes §1-§3, R11): the purse, the three shelves and each
// piece's state. Pure: the camp carries the seals, the stage and the purse, `/api/world` the stall's
// items and prices; the server decides every purchase, these words only say it. Hermès never pushes:
// no discount, no timer, no scarcity, a price is only ever a price.
import { plural, thousands } from '../text/french';
import { isAwake } from './eris';
import { sealNameOf } from './seals';
import { DRAGON_STAGES, LIEUTENANT_ORDER, type CampResponse, type DragonStage, type House, type LieutenantKey, type ShopCatalog } from './types';

export const HOUSE_NAMES: Record<House, string> = { cabin: 'Ta cabane', villa: 'Ta villa', palais: 'Ton palais' };
const HOUSE_OF: Record<House, string> = { cabin: 'de la cabane', villa: 'de la villa', palais: 'du palais' };

/** The room's own shelf follows the house (spec 2026-09-29 drachmes §3): its decor section's title. */
export const houseDecorTitle = (house: House): string => `Objets ${HOUSE_OF[house]}`;

/** The empty shelf's note, in the house the hero lives in. */
export const houseEmptyLine = (house: House): string => `${HOUSE_NAMES[house]} attend ses premiers trésors.`;

/** « 1 drachme », « 1 117 drachmes ». */
export function drachmesText(n: number): string {
  return plural(n, 'drachme', 'drachmes').replace(/^-?\d+/, thousands(n));
}

/** « Ta bourse : 254 drachmes ». */
export const purseLine = (n: number) => `Ta bourse\u202f: ${drachmesText(n)}`;
/** The victory's chip (R15): « +12 drachmes ». */
export const drachmeChip = (n: number) => `+${drachmesText(n)}`;
/** The one confirmation (R12): « Acheter la couronne de pavots pour 130 drachmes ? ». */
export const confirmQuestion = (item: { the: string; price: number }) => `Acheter ${item.the} pour ${drachmesText(item.price)}\u202f?`;
/** An \u00ab Acheter \u00bb button's accessible name (SP4 final review M4): its visible word first, then the
 *  piece and its price, \u00ab Acheter la couronne de pavots pour 130 drachmes \u00bb. */
export const buyLabel = (item: { the: string; price: number }) => `Acheter ${item.the} pour ${drachmesText(item.price)}`;

export type ItemKind = 'accessory' | 'decor' | 'house';
/** The kind of a stall item by its reward id (R1), for Hermès's line after a purchase. */
export const kindOfItem = (id: string): ItemKind => (id.startsWith('accessory:') ? 'accessory' : id.startsWith('house:') ? 'house' : 'decor');

/** « Au sceau de bronze de l'Hydre » (spec §2): a piece's seal, never a number. */
export function lockedAccessoryLine(key: LieutenantKey, level: number): string {
  return `Au ${sealNameOf(key, level)}`;
}

const GROWN: Partial<Record<DragonStage, string>> = { adult: 'adulte', illustre: 'illustre', ancestral: 'ancestral' };
const stageAt = (s: DragonStage) => DRAGON_STAGES.indexOf(s);

type ShopHouse = ShopCatalog['houses'][number];
const houseOnSale = (h: ShopHouse, stage: DragonStage, owned: ReadonlySet<string>) =>
  stageAt(stage) >= stageAt(h.stage) && (h.after === null || owned.has(h.after));

// A house before another, with its article, by its reward id (`house:villa`, R1).
const HOUSE_THE: Record<string, string> = { 'house:villa': 'la villa', 'house:palais': 'le palais' };

/** What a house waits for (R11): the dragon's stage, the house before it (named from `h.after`), or both. */
export function houseLockedLine(h: ShopHouse, stage: DragonStage, owned: ReadonlySet<string>): string {
  const grown = stageAt(stage) >= stageAt(h.stage);
  const before = h.after === null || owned.has(h.after) ? null : `après ${HOUSE_THE[h.after] ?? "la maison d'avant"}`;
  const when = `Quand ton dragon sera ${GROWN[h.stage] ?? h.stage}`;
  if (!grown) return before ? `${when}, ${before}.` : `${when}.`;
  return before ? `${before.charAt(0).toUpperCase()}${before.slice(1)}.` : `${when}.`;
}

export type ItemState = 'owned' | 'on_sale' | 'short' | 'locked';
export interface StallItem {
  id: string;
  name: string;
  the: string;
  price: number;
  state: ItemState;
  /** Under the piece: « À toi », what it waits for, or what the purse still needs; null when it can be bought. */
  note: string | null;
  /** Drachmes still to win for it (0 unless `short`). */
  missing: number;
}

export interface StallShelves {
  accessories: { lieutenant: LieutenantKey; items: StallItem[] }[];
  houses: StallItem[];
  decor: StallItem[];
}

/** The stall's three shelves for this hero (R6, R11): Protée's group only from 8H. */
export function stallShelves(
  shop: ShopCatalog,
  rewards: Record<string, { name: string }>,
  camp: Pick<CampResponse, 'lieutenants' | 'dragon' | 'drachmes'>,
  owned: ReadonlySet<string>,
  heroLevel: string,
): StallShelves {
  const levels = Object.fromEntries(camp.lieutenants.map((l) => [l.key, l.level])) as Record<string, number>;
  const item = (id: string, the: string, price: number, onSale: boolean, locked: string): StallItem => {
    const base = { id, name: rewards[id]?.name ?? the, the, price, missing: 0 };
    if (owned.has(id)) return { ...base, state: 'owned', note: 'À toi' };
    if (!onSale) return { ...base, state: 'locked', note: locked };
    const missing = Math.max(0, price - camp.drachmes);
    return missing > 0 ? { ...base, state: 'short', note: `Encore ${drachmesText(missing)} à gagner.`, missing } : { ...base, state: 'on_sale', note: null };
  };
  const accessories = LIEUTENANT_ORDER.filter((k) => isAwake(k, heroLevel)).map((k) => ({
    lieutenant: k,
    items: shop.accessories
      .filter((a) => a.lieutenant === k)
      .map((a) => item(a.id, a.the, a.price, (levels[k] ?? 0) >= a.level, lockedAccessoryLine(k, a.level))),
  }));
  const stage = camp.dragon.stage;
  const houses = shop.houses.map((h) => item(h.id, h.the, h.price, houseOnSale(h, stage, owned), houseLockedLine(h, stage, owned)));
  const decor = shop.decor.map((d) => item(d.id, d.the, d.price, true, ''));
  return { accessories, houses, decor };
}
