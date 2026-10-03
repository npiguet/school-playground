// The living figures' rigs (spec 2026-10-02 living dragon, "Rigs", plan Ruling R1; spec 2026-10-03
// living battle, plan Rulings B1-B4): the per-vertex weights tools/art/rig.py bakes from
// tools/art/rig.json, one lazily imported chunk per rig: rig/dragon_<stage>.json for the dragon's
// stages, rig/foe_<id>.json for the battle's foes. A rig lives only once it is baked (stages.ts, which
// the game asks without loading this module: it arrives with LivingDragon's chunk).
import { FOE_MOTIONS } from './foes';
import { DRAGON_MOTION, bonesOf, type CreatureMotion, type Pivots } from './pose';
import { FRAME, GRID, SLOTS, VERTS } from './skin';
import { isFoeRig, isLivingRig, type LivingRig } from './stages';

export { FOE_RIGS, FOE_WIDTH, LIVING_STAGES, isFoeRig, livingFoe, livingStage, type FoeRig, type LivingRig, type LivingStage, type Motion } from './stages';

export interface RigFile {
  /** The rig's key: a dragon stage or a foe (the field kept its first name). */
  stage: string;
  source: string;
  grid: number;
  /** A portrait's width in frame px (foes); absent: the whole frame. */
  width?: number;
  pivots: Record<string, [number, number]>;
  /** The feet (or base) box [x0, y0, x1, y1] in frame px: every vertex inside has zero weight. */
  feet: [number, number, number, number];
  /** base64 of VERTS x VERTS x SLOTS bytes. */
  weights: string;
}

export interface Rig {
  id: LivingRig;
  bones: readonly string[];
  motion: CreatureMotion;
  width: number;
  pivots: Pivots;
  feet: readonly [number, number, number, number];
  weights: Uint8Array;
}

export function motionOf(id: LivingRig): CreatureMotion {
  return isFoeRig(id) ? FOE_MOTIONS[id] : DRAGON_MOTION;
}

const DRAGON_FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { import: 'default' });
const FOE_FILES = import.meta.glob<RigFile>('./rig/foe_*.json', { import: 'default' });
const keyed = (files: Record<string, () => Promise<RigFile>>, prefix: string) =>
  Object.entries(files).map(([path, load]) => [path.slice(prefix.length, -'.json'.length), load] as const);
const LOADERS = new Map([...keyed(DRAGON_FILES, './rig/dragon_'), ...keyed(FOE_FILES, './rig/foe_')]);

export function decodeRig(f: RigFile): Rig {
  const id = f.stage;
  if (!isLivingRig(id)) throw new Error(`rig ${id} is neither a dragon stage nor a foe`);
  if (f.grid !== GRID) throw new Error(`rig ${id} has a ${f.grid} grid, the game draws ${GRID}`);
  const width = f.width ?? FRAME;
  if (!(width > 0 && width <= FRAME)) throw new Error(`rig ${id} is ${width} px wide, the frame ${FRAME}`);
  const weights = Uint8Array.from(atob(f.weights), (c) => c.charCodeAt(0));
  if (weights.length !== VERTS * VERTS * SLOTS) throw new Error(`rig ${id} has ${weights.length} weight bytes, not ${VERTS * VERTS * SLOTS}`);
  const motion = motionOf(id);
  const bones = bonesOf(motion);
  for (const b of bones) if (!f.pivots[b]) throw new Error(`rig ${id} has no pivot for ${b}`);
  return { id, bones, motion, width, pivots: f.pivots, feet: f.feet, weights };
}

const cache = new Map<LivingRig, Promise<Rig>>();

export function loadRig(id: LivingRig): Promise<Rig> {
  let p = cache.get(id);
  if (!p) {
    const load = LOADERS.get(id);
    p = load ? load().then(decodeRig) : Promise.reject(new Error(`no rig for ${id}`));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
