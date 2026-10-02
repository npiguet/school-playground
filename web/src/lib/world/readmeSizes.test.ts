// SP4 final review M1: the README's art and sound figures (« about 8.1 MB », « 15 AAC `.m4a` files,
// about 4.9 MB ») are the real folder totals, as the README rounds them: megabytes of 10^6 bytes, one
// decimal. The next art drop that moves them fails here instead of leaving the README wrong.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}
const bytes = (list: string[]) => list.reduce((sum, f) => sum + statSync(f).size, 0);
const mb = (n: number) => Math.round(n / 1e5) / 10;

// The README's lines, rewrapped into one: a figure may sit across a line break.
const readme = readFileSync('../README.md', 'utf-8').replace(/\s+/g, ' ');

describe("the README's art and sound sizes", () => {
  it('states the art folder as it is: all WebP, its size', () => {
    const m = readme.match(/`web\/public\/art` \(WebP, about ([\d.]+) MB\)/);
    expect(m, 'the README names the art folder and its size').not.toBeNull();
    const art = files('public/art');
    expect(art.filter((f) => !f.endsWith('.webp'))).toEqual([]);
    expect(mb(bytes(art))).toBe(Number(m![1]));
  });

  it('states the sound folder as it is: its AAC files and their size', () => {
    const m = readme.match(/`web\/public\/audio` \((\d+) AAC `\.m4a` files, about ([\d.]+) MB\)/);
    expect(m, 'the README names the sound folder, its files and its size').not.toBeNull();
    const audio = files('public/audio');
    expect(audio.filter((f) => !f.endsWith('.m4a'))).toEqual([]);
    expect(audio.length).toBe(Number(m![1]));
    expect(mb(bytes(audio))).toBe(Number(m![2]));
  });
});
