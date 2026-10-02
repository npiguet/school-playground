// The dragon sprites' transparent margin above the head, apart from nest.ts so the e2e can import it
// without the app's modules (web/e2e/scenes-nest.spec.ts checks it against the files themselves).
import type { DragonStage } from '../types';

/** Each stage's sprite (`art/dragon/dragon_<stage>_cut.webp`, 1024x1024): its transparent rows above
 *  the head, as a fraction of its height. Measured with Pillow as the first row with a pixel whose
 *  alpha is above 128 (egg row 61, hatchling 25, young 15, adult 18, illustre 7, ancestral 12); the
 *  e2e (scenes-nest "short screen") measures the same row in the browser and fails, within one row,
 *  when a new cut changes it. */
export const SPRITE_TOP_MARGIN: Record<DragonStage, number> = {
  egg: 61 / 1024,
  hatchling: 25 / 1024,
  young: 15 / 1024,
  adult: 18 / 1024,
  illustre: 7 / 1024,
  ancestral: 12 / 1024,
};
