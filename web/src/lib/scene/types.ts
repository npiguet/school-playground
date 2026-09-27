// Scene data types (scenes UI spec §4). Coordinates are "art %": 0-100 of the 16:9 art frame,
// x left to right, y top to bottom, so scene data survives any art swap of the same framing.
import type { TrackId } from '../audio/catalog';
import type { DialogueKey, TourId } from '../dialogue/types';
import type { RouteName } from '../routes';
import type { CampResponse, WorldCatalog } from '../world/types';

export type Pt = [number, number];

export interface EllipseShape {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PolygonShape {
  kind: 'polygon';
  points: Pt[];
}

export type HotspotShape = EllipseShape | PolygonShape;

/** Hotspot id -> shape. The `<scene>.shapes.ts` files are exactly this: authored by hand from
 *  `docs/art/scenes.md` and checked visually with the `?debug` overlay. */
export type ShapeMap = Record<string, HotspotShape>;

/** Axis-aligned box in art %. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Parallax plane: 0 = the background plane (never moves), 1-3 = cut-out layers (spec: ≤ 3). */
export type Depth = 0 | 1 | 2 | 3;
export type IdlePreset = 'none' | 'bob' | 'sway' | 'breathe';
export type FxPreset = 'none' | 'embers' | 'dust';
export type SceneId = 'camp' | 'title' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin';
/** Where a hotspot's plaque sits: above or below its shape, or written `on` the landmark itself
 *  (ink on parchment, e.g. the war tent's portrait sheets). */
export type LabelPos = 'above' | 'below' | 'on';

/** A positioned cut-out image. `x` = horizontal centre, `y` = bottom edge (feet on the ground),
 *  `scale` = width, all in art %. */
export interface SceneLayerDef {
  id: string;
  src: string;
  /** '' for pure decoration. */
  alt: string;
  x: number;
  y: number;
  scale: number;
  depth: Depth;
  idle: IdlePreset;
}

/** What hotspot state functions may read. `camp` is null until /camp has loaded. */
export interface SceneContext {
  camp: CampResponse | null;
  catalog: WorldCatalog | null;
}

export interface HotspotState {
  visible: boolean;
  locked: boolean;
  /** Draws the stronger "something new here" glow. */
  isNew: boolean;
  /** A count of things to do here (a gold coin on the plaque's corner): active quests. */
  badge: number | null;
  /** Things won here, as small gold seals after the name (UI3b playability #17: a count of what is
   *  done is never the « something waits » coin): the war tent's neutralised lieutenants. */
  seals: number;
  /** Short second line under the place name (dragon name, reward, counts). */
  caption: string | null;
}

export const IDLE_HOTSPOT: HotspotState = { visible: true, locked: false, isNew: false, badge: null, seals: 0, caption: null };

/** A hotspot state: the idle one with these fields changed (every scene module's `state`). */
export const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export interface HotspotDef {
  id: string;
  /** Place name shown on the plaque (Cinzel caps). '' for a hotspot with no plaque (a character you
   *  can tap, e.g. the library owl): it then needs `ariaLabel`. */
  label: string;
  /** The accessible name when `label` is '' (immersion wave, playability #23). */
  ariaLabel?: string;
  /** A bigger plaque for a scene's single call to action (the title's « Entrer », playability #11). */
  grand?: boolean;
  /** Route opened on tap; null when the scene screen handles the tap itself (the title's gate).
   *  Contract: a null-target hotspot's own `onActivate` handler must not navigate away from the
   *  scene. `Hotspot.svelte` never gets a route-change effect to release its one-tap-at-a-time
   *  guard for it (that effect lives on `SceneStage`, keyed off the route), so it releases the
   *  guard itself once the route is confirmed unchanged after the tap. */
  target: RouteName | null;
  /** Extra route params (e.g. `{ key: 'hydre' }`) and hash query (e.g. `{ panel: 'soin' }`). */
  params?: Record<string, string>;
  query?: Record<string, string>;
  /** A painted icon (`ART.icons...` path) drawn on the plaque before the name. */
  icon?: string;
  shape: HotspotShape;
  labelPos: LabelPos;
  /** A short bronze leader line + pin from the shape to its plaque (UI1 carry #17). */
  leader?: boolean;
  /** Slides the plaque sideways, in % of the shape's width (+ to the right), off a landmark of
   *  another place (UI3b playability #10); the leader stays on the shape. */
  labelDx?: number;
  state: (ctx: SceneContext) => HotspotState;
}

export interface SceneDef {
  id: SceneId;
  /** Marble plaque text. */
  title: string;
  background: string;
  layers: SceneLayerDef[];
  hotspots: HotspotDef[];
  ambience: { particles: FxPreset; music: TrackId | null };
  /** The place's greeting key and its first-visit tour (content/dialogue/*.json, UI5). */
  narrator: { enter: DialogueKey | null; tour: TourId | null };
  /** Areas a tour step may ring that are no single hotspot (UI5 playability #10: the war tent's
   *  wall of portraits), by the id the step's `target` names. */
  tourAreas?: ShapeMap;
  /** Backgrounds the player is likely to open next (spec §4 performance). */
  preload: string[];
}

export type SpeakerId = 'dragon' | 'pythia' | 'owl' | 'eris';

export interface DialogueLine {
  speaker: SpeakerId;
  name: string;
  portrait: string;
  portraitFilter?: string;
  text: string;
  /** The content key it came from (spec §8): the dialogue box's data-key, for e2e. */
  key?: string;
}
