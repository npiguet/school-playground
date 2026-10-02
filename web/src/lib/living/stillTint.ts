// The still pictures' tint (user, 2026-10-02: the OKLCH tints at full strength, everywhere the dragon is
// tinted): a dragon picture (a stage, its egg) is tinted once on a 2D canvas with the CPU reference of
// tint.ts, the shader's own steps, and shown from an object URL. getImageData gives straight
// (un-premultiplied) colours, so each pixel is tinted as it is; fully transparent ones are skipped.
// The result is cached per picture and tint for the session, and a picture asked twice while it is
// being made is made once. Until it is ready the untinted picture shows (a bronze dragon); a picture
// that cannot be tinted (no canvas, a failed load) stays untinted.
import type { Action } from 'svelte/action';
import { TINT_SPECS } from '../world/dragon';
import type { Tint } from '../world/types';
import { tintOklch, tintText, type OklchSpec } from './tint';

/** Pixels tinted between two pauses: about a tenth of a 1024 x 1024 sprite, so the page stays responsive. */
const CHUNK = 1 << 17;

/** Tints straight RGBA pixels in place, from pixel `from` up to (not including) pixel `to`, the alpha
 *  untouched; `memo` holds the colours already worked out (a painted sprite repeats many). */
export function tintPixels(data: Uint8ClampedArray, spec: OklchSpec, memo = new Map<number, number>(), from = 0, to = data.length / 4): void {
  for (let p = from; p < to; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let out = memo.get(key);
    if (out === undefined) {
      const [r, g, b] = tintOklch([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255], spec.shift, spec.chroma, spec.lightness);
      out = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
      memo.set(key, out);
    }
    data[i] = out >> 16;
    data[i + 1] = (out >> 8) & 255;
    data[i + 2] = out & 255;
  }
}

/** Makes a tinted picture's URL from a picture's URL. */
export type TintRender = (src: string, spec: OklchSpec) => Promise<string>;

/** The cache of tinted pictures: `peek` answers at once (the URL once made, else null), `get` makes it
 *  at most once per picture and tint (a failed try is forgotten, so a later one may try again). */
export function createStillTints(render: TintRender) {
  const done = new Map<string, string>();
  const making = new Map<string, Promise<string>>();
  const keyOf = (src: string, spec: OklchSpec) => `${src} ${tintText('', spec)}`;
  return {
    peek(src: string, spec: OklchSpec | null): string | null {
      return spec ? (done.get(keyOf(src, spec)) ?? null) : src;
    },
    get(src: string, spec: OklchSpec | null): Promise<string> {
      if (!spec) return Promise.resolve(src);
      const key = keyOf(src, spec);
      const hit = done.get(key);
      if (hit) return Promise.resolve(hit);
      let job = making.get(key);
      if (!job) {
        job = render(src, spec).then(
          (url) => {
            done.set(key, url);
            making.delete(key);
            return url;
          },
          (e: unknown) => {
            making.delete(key);
            throw e;
          },
        );
        making.set(key, job);
      }
      return job;
    },
  };
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The browser's render: the picture drawn on a canvas, tinted by chunks, saved as a PNG blob. */
async function renderInBrowser(src: string, spec: OklchSpec): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2D canvas');
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const memo = new Map<number, number>();
  const count = pixels.data.length / 4;
  for (let from = 0; from < count; from += CHUNK) {
    tintPixels(pixels.data, spec, memo, from, Math.min(count, from + CHUNK));
    await pause();
  }
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob failed');
  return URL.createObjectURL(blob);
}

export const stillTints = createStillTints(renderInBrowser);

/** What `use:tintedDragon` is given: the picture and its tint (null: a picture that is never tinted). */
export interface TintedPicture {
  src: string;
  tint: Tint | null;
}

/** `<img use:tintedDragon={{ src, tint }}>`: sets the picture's `src` (the tinted one once made, the
 *  untinted one meanwhile), `data-src` (the picture asked for) and `data-tint` (the tint the pixels
 *  shown carry: `bronze` while untinted; absent for a picture that is never tinted). */
export const tintedDragon: Action<HTMLImageElement, TintedPicture> = (node, picture) => {
  let token = 0;
  function show(url: string, tint: Tint | null): void {
    if (node.getAttribute('src') !== url) node.src = url;
    if (tint) node.dataset.tint = tint;
    else delete node.dataset.tint;
  }
  function apply({ src, tint }: TintedPicture): void {
    const id = ++token;
    const spec = tint ? TINT_SPECS[tint] : null;
    node.dataset.src = src;
    const ready = stillTints.peek(src, spec);
    if (ready) {
      show(ready, tint);
      return;
    }
    show(src, 'bronze');
    stillTints.get(src, spec).then(
      (url) => {
        if (id === token) show(url, tint);
      },
      () => {}, // stays untinted
    );
  }
  apply(picture);
  return {
    update: apply,
    destroy() {
      token += 1;
    },
  };
};
