// Final review M1: an overlay's title is its h2 (Overlay.svelte); what an overlay body shows sits
// under it - sections are h3, the cards inside a section (a scroll, a quest) h4 - so heading
// navigation reads them as the dialog's children, never as its siblings.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function svelteFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) svelteFiles(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const levels = (file: string) => [...readFileSync(file, 'utf-8').matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));

describe('headings inside overlays', () => {
  it('no overlay panel uses an h1 or h2 (the overlay title is the h2)', () => {
    const files = svelteFiles('src/components/places');
    expect(files.length).toBeGreaterThan(8);
    const found = files.filter((f) => levels(f).some((l) => l <= 2));
    expect(found).toEqual([]);
  });

  it('the cards shown inside an overlay section are h4', () => {
    // One h4 per mode (the rolled scroll's, the unrolled sheet's).
    expect(levels('src/components/places/delphi/OracleScroll.svelte')).toEqual([4, 4]);
    expect(levels('src/components/QuestCard.svelte')).toEqual([4]);
  });

  it('the overlay title itself is the h2', () => {
    expect(levels('src/components/scene/Overlay.svelte')).toEqual([2]);
  });
});
