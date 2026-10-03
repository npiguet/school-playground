// The dragon on the nest's and the camp's layer is either living (a canvas in div.dragon-living, spec
// 2026-10-02 living dragon) or the still picture (img.dragon-base + img.dragon-overlay): which one
// depends on the browser's WebGL2, reduced motion and the stage. These helpers wait for it to settle
// and read its picture, tint and pieces from whichever form it took. Both forms carry `data-src` (the
// picture asked for) and `data-tint` (the tint applied; on the still picture, `bronze` while its tinted
// copy is being made: poll it), Ruling L9.
import { expect, type Locator, type Page } from '@playwright/test';

export type Settled = 'living' | 'still';

export async function settledDragon(layer: Locator): Promise<Settled> {
  const fig = layer.locator('.dragon-figure');
  await expect(fig).toHaveAttribute('data-motion', /^(living|still)$/);
  return (await fig.getAttribute('data-motion')) as Settled;
}

export async function dragonSrc(layer: Locator): Promise<string | null> {
  await settledDragon(layer);
  return layer.locator('.dragon-base').getAttribute('data-src');
}

export async function dragonTint(layer: Locator): Promise<string> {
  await settledDragon(layer);
  return (await layer.locator('.dragon-base').getAttribute('data-tint')) ?? '';
}

export async function dragonWorn(layer: Locator): Promise<string[]> {
  if ((await settledDragon(layer)) === 'living') {
    const worn = (await layer.locator('.dragon-base').getAttribute('data-worn')) ?? '';
    return worn ? worn.split(' ') : [];
  }
  return layer.locator('img.dragon-overlay').evaluateAll((els) => els.map((e) => e.getAttribute('data-item') ?? ''));
}

export async function webgl2Available(page: Page): Promise<boolean> {
  return page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
}

/** Hides everything of the scene but the dragon's layer (fireflies, hotspots, the painting, the
 *  dialogue), so two screenshots of the dragon differ only by the dragon. */
export async function isolateDragon(page: Page, sceneId: string, layerTestId: string): Promise<void> {
  await page.addStyleTag({
    content: `[data-testid="scene-${sceneId}"] *, [data-testid="dialogue-box"], [data-testid="dialogue-box"] * { visibility: hidden !important; }
      [data-testid="${layerTestId}"], [data-testid="${layerTestId}"] * { visibility: visible !important; }`,
  });
}

export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The largest channel difference between two PNG screenshots over a region (fractions), and each
 *  one's mean colour there. Decoded in the page: no PNG library in the e2e image. */
export async function compareShots(page: Page, a: Buffer, b: Buffer, region: Region = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  return page.evaluate(
    async ([a64, b64, r]) => {
      const decode = async (s: string) => {
        const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext('2d');
        if (!g) throw new Error('no 2D context');
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [A, B] = await Promise.all([decode(a64), decode(b64)]);
      const w = Math.min(A.width, B.width);
      const h = Math.min(A.height, B.height);
      const [x0, x1, y0, y1] = [Math.floor(r.x0 * w), Math.ceil(r.x1 * w), Math.floor(r.y0 * h), Math.ceil(r.y1 * h)];
      let maxDiff = 0;
      let n = 0;
      const sa = [0, 0, 0];
      const sb = [0, 0, 0];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const ia = (y * A.width + x) * 4;
          const ib = (y * B.width + x) * 4;
          for (let k = 0; k < 3; k++) {
            maxDiff = Math.max(maxDiff, Math.abs(A.data[ia + k] - B.data[ib + k]));
            sa[k] += A.data[ia + k];
            sb[k] += B.data[ib + k];
          }
          n++;
        }
      }
      return { maxDiff, meanA: sa.map((v) => v / n), meanB: sb.map((v) => v / n) };
    },
    [a.toString('base64'), b.toString('base64'), region] as const,
  );
}

/** This hero's camp says: the dragon as `dragon()` returns it now (stage, tint, worn...). */
export async function mockDragon(page: Page, id: number, dragon: () => Record<string, unknown>) {
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, name: 'Braise', ...dragon() };
    await route.fulfill({ response: res, json: camp });
  });
}
