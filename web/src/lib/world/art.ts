// Map of world art to the WebP files copied into `web/public/art/` (SP3 Task 4).
// Only the cut (alpha) variants are served for characters/dragon/lieutenants/emblems;
// scenes are full-bleed backgrounds and keep their flat background.
import type { Avatar } from '../levels';
import type { LieutenantKey, RewardKind, WorldCatalog } from './types';

const icon = (name: string) => `/art/icons/${name}.webp`;

/** Painted reward icons (UI3 Ruling A12), keyed by the reward ids of server/app/world/catalog.py
 *  REWARDS; decor files keep the art pipeline's `decor-` prefix (a `:` can't be in a file name -
 *  controller Ruling U9). Tints have no icon: they are colour swatches (TINT_SWATCH in dragon.ts). */
export const REWARD_ICONS: Record<string, string> = {
  ecaille_hydre: icon('ecaille_hydre'),
  voix_echo: icon('voix_echo'),
  criniere_chimere: icon('criniere_chimere'),
  perle_protee: icon('perle_protee'),
  plume_sirene: icon('plume_sirene'),
  pavot_lethe: icon('pavot_lethe'),
  sandales_hermes: icon('sandales_hermes'),
  egide: icon('egide'),
  foudre_zeus: icon('foudre_zeus'),
  'decor:lanterne': icon('decor-lanterne'),
  'decor:tapis': icon('decor-tapis'),
  'decor:bibliotheque': icon('decor-bibliotheque'),
  'decor:trophee': icon('decor-trophee'),
  'decor:fresque': icon('decor-fresque'),
};

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

/** The proofreading help tools (Bouclier de Persée, Chouette d'Athéna, Fil d'Ariane, Argus). */
export const TOOL_ICONS = {
  persee: icon('tool-persee'),
  athena: icon('tool-athena'),
  ariane: icon('tool-ariane'),
  argus: icon('tool-argus'),
} as const;

/** The three ways to bring a text into the library (desk, lens, portal). */
export const ADD_ICONS = {
  text: icon('add-text'),
  scan: icon('add-scan'),
  alexandria: icon('add-alexandria'),
} as const;

/** Small marks: the Oracle's wax seal, a padlock. */
export const MARK_ICONS = {
  oracleSeal: icon('seal-oracle'),
  lock: icon('lock'),
} as const;

/** Place plaques that carry a painted icon but are not one of the three ways in (UI3a playability #20). */
export const PLACE_ICONS = {
  portal: icon('portal-arch'),
} as const;

/** The relic each lieutenant leaves when neutralised (catalog.py LIEUTENANTS[*].relic). */
export const RELIC_OF: Record<LieutenantKey, string> = {
  hydre: 'ecaille_hydre',
  echo: 'voix_echo',
  chimere: 'criniere_chimere',
  protee: 'perle_protee',
  sirenes: 'plume_sirene',
  lethe: 'pavot_lethe',
};

export const ART = {
  eris: '/art/characters/eris_cut.webp',
  erisSmug: '/art/characters/eris_smug_cut.webp',
  dragon: {
    egg: '/art/dragon/dragon_egg_cut.webp',
    hatchling: '/art/dragon/dragon_hatchling_cut.webp',
    young: '/art/dragon/dragon_young_cut.webp',
    adult: '/art/dragon/dragon_adult_cut.webp',
  },
  lieutenants: {
    hydre: '/art/lieutenants/hydre_cut.webp',
    echo: '/art/lieutenants/echo_cut.webp',
    chimere: '/art/lieutenants/chimere_cut.webp',
    protee: '/art/lieutenants/protee_cut.webp',
    sirenes: '/art/lieutenants/sirenes_cut.webp',
    lethe: '/art/lieutenants/lethe_cut.webp',
  },
  emblems: {
    argus: '/art/emblems/argus_cut.webp',
    ariane: '/art/emblems/ariane_cut.webp',
    persee: '/art/emblems/persee_cut.webp',
    athena: '/art/emblems/athena_cut.webp',
    apple: '/art/emblems/apple_cut.webp',
  },
  // UI2 cut-outs (docs/art/scenes.md): the Pythia on her tripod, Athena's owl, three props.
  characters: {
    pythia: '/art/characters/pythia_cut.webp',
    owl: '/art/characters/owl_cut.webp',
  },
  // Not referenced yet on purpose (final review M7): UI3b's inputs for the war tent's codex
  // lectern, the cabin's trophy shelf and a closer view of Delphi's tablets.
  props: {
    votiveTablets: '/art/props/votive_tablets_cut.webp',
    codexLectern: '/art/props/codex_lectern_cut.webp',
    trophyShelf: '/art/props/trophy_shelf_cut.webp',
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
  // No `parchment` key: all three tried seeds (903-905) vignetted (docs/art/style-guide.md §5), so the
  // parchment stays a CSS gradient plus inline SVG grain (Task 2).
  textures: {
    marble: '/art/textures/marble.webp',
    woodBoard: '/art/textures/wood_board.webp',
  },
  ui: {
    scrollRolled: '/art/ui/scroll_rolled.webp',
  },
  scenes: {
    camp: '/art/scenes/camp.webp',
    delphes: '/art/scenes/delphes.webp',
    alexandrie: '/art/scenes/alexandrie.webp',
    parchemins: '/art/scenes/parchemins.webp',
    battle: '/art/scenes/battle.webp',
    // UI2 scenes (2048×1152), one per place (docs/art/scenes.md).
    titleGates: '/art/scenes/title_gates.webp',
    hubCamp: '/art/scenes/hub_camp.webp',
    nest: '/art/scenes/nest.webp',
    delphi: '/art/scenes/delphi.webp',
    libraryTent: '/art/scenes/library_tent.webp',
    warTent: '/art/scenes/war_tent.webp',
    cabin: '/art/scenes/cabin.webp',
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

export function rewardIcon(id: string): string | null {
  return REWARD_ICONS[id] ?? null;
}

export function avatarIcon(avatar: string): string {
  return AVATAR_ICONS[avatar as Avatar] ?? AVATAR_ICONS.chouette;
}

export function lieutenantIcon(key: string): string | null {
  return LIEUTENANT_ICONS[key as LieutenantKey] ?? null;
}

/** The server's own catalog is the source of truth for a reward's kind (review round 1 #7); the
 *  id-prefix/RELIC_OF guess below covers the moment before the catalog has loaded. Medallion is
 *  the one caller (final review M6), always with `campStore.catalog`. */
export function rewardKindOf(id: string, catalog?: WorldCatalog | null): RewardKind {
  const fromCatalog = catalog?.rewards[id]?.kind;
  if (fromCatalog) return fromCatalog;
  if (id.startsWith('tint:')) return 'tint';
  if (id.startsWith('decor:')) return 'decor';
  return (Object.values(RELIC_OF) as string[]).includes(id) ? 'relic' : 'gear';
}
