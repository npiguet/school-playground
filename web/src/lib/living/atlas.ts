// The worn pieces on the living dragon (spec 2026-10-02 living dragon, "Pieces"; plan Ruling R2): each
// piece gets a 512 px cell of one 1024 atlas texture and is drawn as its own quad at its manifest box,
// back to front (accessoryLayers already orders them by DRAW_ORDER), skinned with the dragon's weights
// at its anchor, the box's centre, less the breath: a rigid passenger that never stretches, the saddle
// included.
import type { OverlayLayer } from '../world/accessories';
import { BONES, FRAME, frameOffset, weightsAt } from './skin';

export const ATLAS = 1024;
export const ATLAS_CELL = 512;

export interface PiecePlacement {
  item: string;
  src: string;
  /** The box in the frame, px: x0, y0, x1, y1. */
  frame: [number, number, number, number];
  /** Where the crop is drawn in the atlas, px: x, y, w, h. */
  atlas: [number, number, number, number];
  atlasUv: [number, number, number, number];
  anchor: [number, number];
}

export interface PieceDraw {
  frame: readonly [number, number, number, number];
  atlasUv: readonly [number, number, number, number];
  weights: Float32Array;
}

export function placePieces(overlays: readonly OverlayLayer[]): PiecePlacement[] {
  if (overlays.length > 4) throw new Error(`got ${overlays.length} pieces, at most one per slot`);
  return overlays.map((o, n) => {
    const x0 = (o.left / 100) * FRAME;
    const y0 = (o.top / 100) * FRAME;
    const w = (o.width / 100) * FRAME;
    const h = (o.height / 100) * FRAME;
    const pw = Math.ceil(w);
    const ph = Math.ceil(h);
    if (pw > ATLAS_CELL || ph > ATLAS_CELL) throw new Error(`piece ${o.item} is ${pw} x ${ph} px, bigger than an atlas cell`);
    const ax = (n % 2) * ATLAS_CELL;
    const ay = Math.floor(n / 2) * ATLAS_CELL;
    return {
      item: o.item,
      src: o.src,
      frame: [x0, y0, x0 + w, y0 + h],
      atlas: [ax, ay, pw, ph],
      atlasUv: [ax / ATLAS, ay / ATLAS, (ax + pw) / ATLAS, (ay + ph) / ATLAS],
      anchor: [x0 + w / 2, y0 + h / 2],
    };
  });
}

const CHEST = BONES.indexOf('chest');

/** Each piece's quad with the dragon's weights at its anchor, the chest's dropped (Ruling L5): the breath
 *  is a scale, and a rigid passenger only turns and lifts with the dragon, it is never scaled. */
export function pieceDraws(placed: readonly PiecePlacement[], weights: Uint8Array): PieceDraw[] {
  return placed.map((p) => {
    const w = weightsAt(weights, p.anchor[0], p.anchor[1]);
    w[CHEST] = 0;
    return { frame: p.frame, atlasUv: p.atlasUv, weights: w };
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
}

/** The sprite as the frame its rig was baked on (plan Ruling B2): a portrait narrower than the frame is
 *  drawn into a FRAME square, centred (skin.ts frameOffset, as tools/art/rig.py pads it). A picture of
 *  another size than the rig's throws: the caller shows the still picture. */
export function padToFrame(img: HTMLImageElement, width: number): TexImageSource {
  if (img.naturalHeight !== FRAME || img.naturalWidth !== width) throw new Error(`a ${img.naturalWidth} x ${img.naturalHeight} picture, the rig wants ${width} x ${FRAME}`);
  if (width === FRAME) return img;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME;
  canvas.height = FRAME;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2D canvas to frame the sprite');
  g.drawImage(img, frameOffset(width), 0);
  return canvas;
}

export async function buildAtlas(placed: readonly PiecePlacement[]): Promise<HTMLCanvasElement> {
  const images = await Promise.all(placed.map((p) => loadImage(p.src)));
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2D canvas for the piece atlas');
  placed.forEach((p, n) => g.drawImage(images[n], p.atlas[0], p.atlas[1], p.atlas[2], p.atlas[3]));
  return canvas;
}
