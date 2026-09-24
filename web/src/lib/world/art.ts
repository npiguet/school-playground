// Map of world art to the WebP files copied into `web/public/art/` (SP3 Task 4).
// Only the cut (alpha) variants are served for characters/dragon/lieutenants/emblems;
// scenes are full-bleed backgrounds and keep their flat background.

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
  scenes: {
    camp: '/art/scenes/camp.webp',
    delphes: '/art/scenes/delphes.webp',
    alexandrie: '/art/scenes/alexandrie.webp',
    parchemins: '/art/scenes/parchemins.webp',
    argus: '/art/scenes/argus.webp',
    battle: '/art/scenes/battle.webp',
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
