// UI3 end state (spec §3, carry rec. 8, UI3 Ruling B7): every screen is a place scene except the two
// battle screens UI4 restages; the legacy top nav survives only there; no place uses the legacy
// `.screen` page or `.scene` banner classes (the kit classes are placesKit.test.ts's job).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const LEGACY_CLASS = /class="(?:[^"]*\s)?(?:screen|scene)(?:\s[^"]*)?"/;

describe('UI3: the places replaced the screens', () => {
  it('keeps exactly the place scenes and the two battle screens', () => {
    expect(readdirSync('src/screens').filter((f) => f.endsWith('.svelte')).sort()).toEqual([
      'Boss.svelte',
      'CabinRoom.svelte',
      'Camp.svelte',
      'Delphi.svelte',
      'LibraryTent.svelte',
      'Nest.svelte',
      'Play.svelte',
      'Title.svelte',
      'WarTent.svelte',
    ]);
  });

  it('keeps the legacy top nav only on Play and Boss', () => {
    const users = walk('src').filter((f) => /import TopBar from/.test(readFileSync(f, 'utf-8')));
    expect(users.map((f) => basename(f)).sort()).toEqual(['Boss.svelte', 'Play.svelte']);
  });

  it('uses no legacy .screen / .scene class in a place', () => {
    const places = [...walk('src/components/places'), ...walk('src/screens').filter((f) => !/(Boss|Play)\.svelte$/.test(f))];
    for (const f of places) expect(readFileSync(f, 'utf-8'), f).not.toMatch(LEGACY_CLASS);
  });

  it('shows the profile gate on the night backdrop, not on a legacy page', () => {
    const app = readFileSync('src/App.svelte', 'utf-8');
    expect(app).not.toMatch(LEGACY_CLASS);
    expect(app).toContain('data-testid="gate-loading"');
    expect(app).toContain('data-testid="gate-error"');
  });
});
