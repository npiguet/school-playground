// Scenes UI spec §4: "≤ 600 KB WebP per scene background [...] A test/script fails if a scene
// background exceeds the budget." Runs in scripts/check.sh via vitest.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { HOUSE_SCENES, NEST_STAGE_SCENES, SCENES, SCENE_BUDGET_BYTES } from './index';

describe('scene weight budget', () => {
  it('keeps every scene background under public/art/scenes within 600 KB', () => {
    const files = readdirSync('public/art/scenes').filter((f) => f.endsWith('.webp'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(statSync(`public/art/scenes/${f}`).size, f).toBeLessThanOrEqual(SCENE_BUDGET_BYTES);
    }
  });

  it('points every scene background and preload at an existing WebP within budget', () => {
    for (const scene of [...SCENES, ...HOUSE_SCENES, ...NEST_STAGE_SCENES]) {
      for (const src of [scene.background, ...scene.preload]) {
        const file = 'public' + src;
        expect(existsSync(file), `${scene.id}: ${src}`).toBe(true);
        expect(src.endsWith('.webp'), src).toBe(true);
        expect(statSync(file).size, src).toBeLessThanOrEqual(SCENE_BUDGET_BYTES);
      }
    }
  });
});
