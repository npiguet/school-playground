// Stage geometry (scenes UI spec §4 + plan Ruling 3): the 16:9 art box, the centred 4:3 safe
// zone, hotspot shape boxes and the pointer parallax. Pure functions, art % unless noted.
import type { Box, Depth, HotspotShape } from './types';

export const ART_ASPECT = 16 / 9;
/** Centred 4:3 zone of the 16:9 art: always visible, so every interactive element lives here. */
export const SAFE_ZONE: Box = { x: 12.5, y: 0, w: 75, h: 100 };
/** Hotspots start below this y so the viewport-anchored HUD never covers them. */
export const HUD_BAND = 14;
/** Where the DialogueBox sits; hotspots must not overlap it. */
export const DIALOGUE_DOCK: Box = { x: 27, y: 80, w: 60.5, h: 20 };
/** Art % of horizontal travel per depth unit at full pointer deflection. */
export const PARALLAX_STEP = 0.6;

/** The art box in viewport pixels. */
export interface StageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100 + 0;

/** Height-fit 16:9 box (= cover on every landscape viewport down to 4:3, side bands when wider
 *  than 16:9), shrunk when narrower than 4:3 so the safe zone is never cropped. */
export function stageBox(vw: number, vh: number): StageBox {
  const width = Math.min(vh * ART_ASPECT, vw / (SAFE_ZONE.w / 100));
  const height = width / ART_ASPECT;
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
}

export function shapeBox(s: HotspotShape): Box {
  if (s.kind === 'ellipse') {
    return { x: round2(s.cx - s.rx), y: round2(s.cy - s.ry), w: round2(2 * s.rx), h: round2(2 * s.ry) };
  }
  const xs = s.points.map((p) => p[0]);
  const ys = s.points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: round2(Math.max(...xs) - x), h: round2(Math.max(...ys) - y) };
}

export function boxInside(inner: Box, outer: Box): boolean {
  const eps = 1e-9;
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.w <= outer.x + outer.w + eps &&
    inner.y + inner.h <= outer.y + outer.h + eps
  );
}

/** Strict overlap: boxes that only touch along an edge do not overlap. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** CSS clip-path for an element that covers exactly `shapeBox(s)`. A zero-width or zero-height
 *  box (collinear points, e.g. a hand-typed polygon whose points line up) would divide by zero below; instead
 *  of ever emitting `NaN%`, collapse to a single point so the clip is merely invisible. Scene data
 *  itself is still rejected by `validateShapes`; this is the unconditional runtime backstop. */
export function clipPath(s: HotspotShape): string {
  if (s.kind === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  const b = shapeBox(s);
  if (b.w <= 0 || b.h <= 0) return 'polygon(0% 0%, 0% 0%, 0% 0%)';
  const pts = s.points.map(([x, y]) => `${round2(((x - b.x) / b.w) * 100)}% ${round2(((y - b.y) / b.h) * 100)}%`);
  return `polygon(${pts.join(', ')})`;
}

/** Offset in art % for a layer at `depth`, pointer at (nx, ny) in [-1, 1]. */
export function parallaxOffset(depth: Depth, nx: number, ny: number): { x: number; y: number } {
  return { x: round2(-nx * depth * PARALLAX_STEP), y: round2(-ny * depth * PARALLAX_STEP * 0.5) };
}

export function pointerToNorm(clientX: number, clientY: number, vw: number, vh: number): { nx: number; ny: number } {
  const c = (v: number) => Math.max(-1, Math.min(1, v)) + 0;
  return { nx: vw > 0 ? c((clientX / vw) * 2 - 1) : 0, ny: vh > 0 ? c((clientY / vh) * 2 - 1) : 0 };
}

/** Gap in px kept between a hotspot label plaque and the safe-zone edge. */
export const LABEL_MARGIN_PX = 8;

/**
 * Horizontal shift in px that keeps a label plaque inside the 4:3 safe zone (final review I4,
 * playability #1): a label is centred on its hotspot, so one near the zone's edge (« Le chemin de
 * Delphes » at x 17 %) would otherwise stick out into the part of the art an iPad crops away.
 * `centreX` is the hotspot centre in art %, `width` the plaque width in px, `artW` the art box
 * width in px. Returns 0 when the centred plaque already fits; a plaque wider than the zone is
 * centred in it.
 */
export function labelShift(centreX: number, width: number, artW: number, margin = LABEL_MARGIN_PX): number {
  if (artW <= 0 || width <= 0) return 0;
  const min = (SAFE_ZONE.x / 100) * artW + margin;
  const max = ((SAFE_ZONE.x + SAFE_ZONE.w) / 100) * artW - margin;
  const left = (centreX / 100) * artW - width / 2;
  if (width > max - min) return round2((min + max) / 2 - width / 2 - left);
  return round2(Math.min(max - width, Math.max(min, left)) - left);
}
