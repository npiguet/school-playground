// Scene data checks (scenes UI spec §4, plan Ruling 3). Used by the scene unit tests to check the
// hand-authored shapes (docs/art/scenes.md, checked visually with the `?debug` overlay). Returns
// human-readable problems; [] means valid.
import { DIALOGUE_DOCK, HUD_BAND, SAFE_ZONE, boxInside, boxesOverlap, shapeBox } from './geometry';
import type { SceneDef, ShapeMap } from './types';

export function validateShapes(shapes: ShapeMap): string[] {
  const problems: string[] = [];
  const entries = Object.entries(shapes);
  for (const [id, s] of entries) {
    if (s.kind === 'ellipse' && (s.rx <= 0 || s.ry <= 0)) problems.push(`${id}: radii must be > 0`);
    if (s.kind === 'polygon' && s.points.length < 3) problems.push(`${id}: a polygon needs at least 3 points`);
    const b = shapeBox(s);
    // A zero-width or zero-height box (collinear points) would make clipPath() divide by zero and
    // emit an NaN% clip-path; reject it here so no hotspot data can ever produce one.
    if (s.kind === 'polygon' && (b.w <= 0 || b.h <= 0)) problems.push(`${id}: polygon has zero area`);
    if (!boxInside(b, SAFE_ZONE)) {
      problems.push(`${id}: outside the 4:3 safe zone (x ${SAFE_ZONE.x}-${SAFE_ZONE.x + SAFE_ZONE.w})`);
    }
    if (b.y < HUD_BAND) problems.push(`${id}: under the HUD band (y < ${HUD_BAND})`);
    if (boxesOverlap(b, DIALOGUE_DOCK)) problems.push(`${id}: overlaps the dialogue dock`);
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (boxesOverlap(shapeBox(entries[i][1]), shapeBox(entries[j][1]))) {
        problems.push(`${entries[i][0]} overlaps ${entries[j][0]}`);
      }
    }
  }
  return problems;
}

export function validateScene(scene: SceneDef): string[] {
  const problems: string[] = [];
  const ids = scene.hotspots.map((h) => h.id);
  for (const d of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) problems.push(`duplicate hotspot id: ${d}`);
  problems.push(...validateShapes(Object.fromEntries(scene.hotspots.map((h) => [h.id, h.shape]))));
  for (const l of scene.layers) {
    if (l.scale <= 0 || l.x < 0 || l.x > 100 || l.y < 0 || l.y > 100) {
      problems.push(`layer ${l.id}: position/scale out of range`);
    }
  }
  return problems;
}
