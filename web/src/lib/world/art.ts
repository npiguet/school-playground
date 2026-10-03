// Map of world art to the WebP files copied into `web/public/art/` (SP3 Task 4).
// Only the cut (alpha) variants are served for characters/dragon/lieutenants/emblems;
// scenes are full-bleed backgrounds and keep their flat background.
import type { Avatar } from '../levels';
import { LIEUTENANT_ORDER, type LieutenantKey, type RewardKind, type WorldCatalog } from './types';

const icon = (name: string) => `/art/icons/${name}.webp`;

/** Painted reward icons (UI3 Ruling A12), keyed by the reward ids of server/app/world/catalog.py
 *  REWARDS; decor files keep the art pipeline's `decor-` prefix (a `:` can't be in a file name -
 *  controller Ruling U9). Tints have no icon: they are colour swatches (TINT_SWATCH in dragon.ts). */
export const REWARD_ICONS: Record<string, string> = {
  sandales_hermes: icon('sandales_hermes'),
  egide: icon('egide'),
  foudre_zeus: icon('foudre_zeus'),
  'decor:lanterne': icon('decor-lanterne'),
  'decor:tapis': icon('decor-tapis'),
  'decor:bibliotheque': icon('decor-bibliotheque'),
  'decor:trophee': icon('decor-trophee'),
  'decor:fresque': icon('decor-fresque'),
  // Spec 2026-09-29 drachmes §2: Hermès's four pieces.
  'decor:amphore': icon('decor-amphore'),
  'decor:chouette': icon('decor-chouette'),
  'decor:mosaique': icon('decor-mosaique'),
  'decor:bouclier': icon('decor-bouclier'),
};

const treasure = (name: string) => `/art/treasures/${name}.webp`;

/** The twelve pieces that stand in the rooms (spec 2026-10-02 house treasures), front-facing
 *  cut-outs trimmed to the object, keyed by reward id like REWARD_ICONS (the same file names). */
export const TREASURE_ART = {
  sandales_hermes: treasure('sandales_hermes'),
  egide: treasure('egide'),
  foudre_zeus: treasure('foudre_zeus'),
  'decor:lanterne': treasure('decor-lanterne'),
  'decor:tapis': treasure('decor-tapis'),
  'decor:bibliotheque': treasure('decor-bibliotheque'),
  'decor:trophee': treasure('decor-trophee'),
  'decor:fresque': treasure('decor-fresque'),
  'decor:amphore': treasure('decor-amphore'),
  'decor:chouette': treasure('decor-chouette'),
  'decor:mosaique': treasure('decor-mosaique'),
  'decor:bouclier': treasure('decor-bouclier'),
} as const;

/** The hero emblems (was AVATAR_GLYPHS, UI3 Ruling A13). */
export const AVATAR_ICONS: Record<Avatar, string> = {
  chouette: icon('avatar-chouette'),
  dragon: icon('avatar-dragon'),
  lyre: icon('avatar-lyre'),
  trident: icon('avatar-trident'),
  laurier: icon('avatar-laurier'),
  foudre: icon('avatar-foudre'),
};

/** The ONE source of the lieutenants' small icons (was the server's `glyph` + five client copies). */
export const LIEUTENANT_ICONS: Record<LieutenantKey, string> = {
  hydre: icon('lt-hydre'),
  echo: icon('lt-echo'),
  chimere: icon('lt-chimere'),
  protee: icon('lt-protee'),
  sirenes: icon('lt-sirenes'),
  lethe: icon('lt-lethe'),
};

/** The proofreading's review aids (Persée, Athéna, Ariane, Argus, Palamède). */
export const TOOL_ICONS = {
  persee: icon('tool-persee'),
  athena: icon('tool-athena'),
  ariane: icon('tool-ariane'),
  argus: icon('tool-argus'),
  palamede: icon('tool-palamede'),
} as const;

/** The three ways to bring a text into the library (desk, lens, portal). */
export const ADD_ICONS = {
  text: icon('add-text'),
  scan: icon('add-scan'),
  alexandria: icon('add-alexandria'),
} as const;

/** Small marks: the Oracle's wax seal, a padlock, the drachme coin (spec 2026-09-29 drachmes §1). */
export const MARK_ICONS = {
  oracleSeal: icon('seal-oracle'),
  lock: icon('lock'),
  drachme: icon('drachme'),
} as const;

/** Place plaques that carry a painted icon but are not one of the three ways in (UI3a playability #20). */
export const PLACE_ICONS = {
  portal: icon('portal-arch'),
} as const;

/** The lieutenants' trophies (spec 2026-09-29 lieutenant levels §1, art spec Phase 3): one per seal,
 *  the old relic as a statuette in the seal's material; the icon (256 px) and the shelf's close view
 *  (512 px), index = seal - 1. */
const trophyPath = (key: LieutenantKey, level: number, large: boolean) => `/art/trophies/${large ? 'large/' : ''}trophy-${key}-${level}.webp`;
const trophiesOf = (large: boolean) =>
  Object.fromEntries(LIEUTENANT_ORDER.map((k) => [k, [1, 2, 3, 4, 5].map((l) => trophyPath(k, l, large))])) as Record<LieutenantKey, string[]>;
export const TROPHY_ICONS = trophiesOf(false);
export const TROPHY_LARGE = trophiesOf(true);

export const ART = {
  eris: '/art/characters/eris_cut.webp',
  erisSmug: '/art/characters/eris_smug_cut.webp',
  // UI4 Task A: Éris routed (the boss's `defeat` reaction), a sore loser caught off guard.
  erisFlustered: '/art/characters/eris_flustered_cut.webp',
  dragon: {
    egg: '/art/dragon/dragon_egg_cut.webp',
    hatchling: '/art/dragon/dragon_hatchling_cut.webp',
    young: '/art/dragon/dragon_young_cut.webp',
    // Sub-project 3: the adult redrawn in the young dragon's three-quarter pose, and the two new stages.
    adult: '/art/dragon/dragon_adult_cut.webp',
    illustre: '/art/dragon/dragon_illustre_cut.webp',
    ancestral: '/art/dragon/dragon_ancestral_cut.webp',
  },
  // Spec 2026-10-02 nest by stage: the nest painted for each stage of the dragon, the place growing
  // around it (docs/art/scenes.md "nest_<stage>"). Scene backgrounds: the 600 KB budget applies.
  nest: {
    egg: '/art/scenes/nest_egg.webp',
    hatchling: '/art/scenes/nest_hatchling.webp',
    young: '/art/scenes/nest_young.webp',
    adult: '/art/scenes/nest_adult.webp',
    illustre: '/art/scenes/nest_illustre.webp',
    ancestral: '/art/scenes/nest_ancestral.webp',
  },
  lieutenants: {
    hydre: '/art/lieutenants/hydre_cut.webp',
    echo: '/art/lieutenants/echo_cut.webp',
    chimere: '/art/lieutenants/chimere_cut.webp',
    protee: '/art/lieutenants/protee_cut.webp',
    sirenes: '/art/lieutenants/sirenes_cut.webp',
    lethe: '/art/lieutenants/lethe_cut.webp',
  },
  trophies: { icons: TROPHY_ICONS, large: TROPHY_LARGE },
  // Spec 2026-10-02 house treasures: the gear and decor standing in the rooms (scenes/treasures.ts).
  treasures: TREASURE_ART,
  emblems: {
    argus: '/art/emblems/argus_cut.webp',
    ariane: '/art/emblems/ariane_cut.webp',
    persee: '/art/emblems/persee_cut.webp',
    athena: '/art/emblems/athena_cut.webp',
    palamede: '/art/emblems/palamede_cut.webp',
    apple: '/art/emblems/apple_cut.webp',
  },
  // UI2 cut-outs (docs/art/scenes.md): the Pythia on her tripod, Athena's owl, three props.
  characters: {
    pythia: '/art/characters/pythia_cut.webp',
    owl: '/art/characters/owl_cut.webp',
    // Spec 2026-09-29 drachmes §2: Hermès at his stall.
    hermes: '/art/characters/hermes_cut.webp',
  },
  // Not referenced yet on purpose (final review M7): UI3b's inputs for the war tent's codex
  // lectern, the cabin's trophy shelf and a closer view of Delphi's tablets.
  props: {
    votiveTablets: '/art/props/votive_tablets_cut.webp',
    codexLectern: '/art/props/codex_lectern_cut.webp',
    trophyShelf: '/art/props/trophy_shelf_cut.webp',
  },
  // UI4 Task A: the victory sheet's painted chest (VictoryChest.svelte, the `crown` snippet's
  // painted alternative to the laurel wreath when the spoils hold a reward).
  battle: {
    chestClosed: '/art/battle/chest_closed.webp',
    chestOpen: '/art/battle/chest_open.webp',
  },
  icons: {
    rewards: REWARD_ICONS,
    avatars: AVATAR_ICONS,
    lieutenants: LIEUTENANT_ICONS,
    tools: TOOL_ICONS,
    add: ADD_ICONS,
    marks: MARK_ICONS,
    places: PLACE_ICONS,
  },
  // Immersion wave (Ruling W3): overlay surfaces and objects; CSS reads the textures as tokens (kit.css).
  // Parchment retry (2026-09-25): prompted explicitly as a low-contrast text background, generated
  // with `--tiling` and flattened with uiart.py's `flatten()` pass before `seamless()` — see
  // docs/art/style-guide.md §5.
  textures: {
    marble: '/art/textures/marble.webp',
    parchment: '/art/textures/parchment.webp',
    woodBoard: '/art/textures/wood_board.webp',
  },
  ui: {
    scrollRolled: '/art/ui/scroll_rolled.webp',
  },
  scenes: {
    delphes: '/art/scenes/delphes.webp',
    alexandrie: '/art/scenes/alexandrie.webp',
    parchemins: '/art/scenes/parchemins.webp',
    // The old battlefield: no battle stage uses it since UI4, but the war tent's lieutenant portrait
    // stands on it (PortraitPanel), so it stays (artReferenced.test.ts).
    battle: '/art/scenes/battle.webp',
    // UI4 battle backdrops (docs/art/scenes.md "Battle backdrops"), one per ground (lib/battle/battle.ts HOME).
    battleRiver: '/art/scenes/battle_river.webp',
    battleCoast: '/art/scenes/battle_coast.webp',
    battleTemple: '/art/scenes/battle_temple.webp',
    erisLair: '/art/scenes/eris_lair.webp',
    // UI2 scenes (2048×1152), one per place (docs/art/scenes.md).
    titleGates: '/art/scenes/title_gates.webp',
    // The camp with Hermès's stall painted in (spec 2026-09-29 drachmes §2).
    hubCamp: '/art/scenes/hub_camp.webp',
    delphi: '/art/scenes/delphi.webp',
    libraryTent: '/art/scenes/library_tent.webp',
    warTent: '/art/scenes/war_tent.webp',
    cabin: '/art/scenes/cabin.webp',
    // Spec 2026-09-29 drachmes §3: the houses bought from Hermès, the cabin's room plan.
    villa: '/art/scenes/villa.webp',
    palais: '/art/scenes/palais.webp',
  },
} as const;

export const ART_SIZES = {
  portrait: { w: 768, h: 1344 },
  square: { w: 1024, h: 1024 },
  scene: { w: 1344, h: 768 },
};

/** Resolves an art path by kind + key (e.g. `artFor('lieutenant', 'hydre')`); throws on an
 *  unknown key so a typo surfaces immediately instead of rendering a broken image. */
export function artFor(kind: 'lieutenant' | 'dragon' | 'scene' | 'emblem', key: string): string {
  const table: Record<typeof kind, Record<string, string>> = {
    lieutenant: ART.lieutenants,
    dragon: ART.dragon,
    scene: ART.scenes,
    emblem: ART.emblems,
  };
  const path = table[kind][key];
  if (!path) throw new Error(`Unknown ${kind} art key: ${key}`);
  return path;
}

/** A lieutenant's trophy for a seal (1-5), or null for an unknown lieutenant or seal. */
export function trophyIcon(key: string, level: number, large = false): string | null {
  const list = (large ? TROPHY_LARGE : TROPHY_ICONS)[key as LieutenantKey];
  return list && Number.isInteger(level) && level >= 1 && level <= list.length ? list[level - 1] : null;
}

const TROPHY_ID = /^trophy:([a-z]+):(\d)$/;

export function rewardIcon(id: string): string | null {
  const m = TROPHY_ID.exec(id);
  return REWARD_ICONS[id] ?? (m ? trophyIcon(m[1], Number(m[2])) : null);
}

export function avatarIcon(avatar: string): string {
  return AVATAR_ICONS[avatar as Avatar] ?? AVATAR_ICONS.chouette;
}

export function lieutenantIcon(key: string): string | null {
  return LIEUTENANT_ICONS[key as LieutenantKey] ?? null;
}

/** The server's own catalog is the source of truth for a reward's kind (review round 1 #7); the
 *  id-prefix guess below covers the moment before the catalog has loaded. Medallion is
 *  the one caller (final review M6), always with `campStore.catalog`. */
export function rewardKindOf(id: string, catalog?: WorldCatalog | null): RewardKind {
  const fromCatalog = catalog?.rewards[id]?.kind;
  if (fromCatalog) return fromCatalog;
  if (id.startsWith('trophy:')) return 'trophy';
  if (id.startsWith('tint:')) return 'tint';
  if (id.startsWith('decor:')) return 'decor';
  if (id.startsWith('accessory:')) return 'accessory';
  if (id.startsWith('house:')) return 'house';
  return 'gear';
}
