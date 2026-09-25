// Hotspot geometry of Delphi (delphi.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (tripod x 27-38, y 39-75 + the Pythia cut-out over it; tablet wall x 53-82,
// y 22-57) and checked with `?debug`. The altar below the wall (y 60-78) holds the prophecy card.
import type { ShapeMap } from '../../scene/types';

export const DELPHI_SHAPES = {
  pythia: { kind: 'polygon', points: [[26, 30], [39, 30], [40.5, 76], [24.5, 76]] },
  tablets: { kind: 'polygon', points: [[53.5, 23], [81.5, 23], [81.5, 56], [53.5, 56]] },
} satisfies ShapeMap;
