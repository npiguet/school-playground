// UI5 (spec §7, iPad Safari): one AudioContext (Howler's), Web Audio only (iOS ignores an HTML media
// element's volume, so ducking would fail silently), and no audio code reads reduced motion (sound is
// not motion; spec §4's rule leaves it alone).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|svelte)$/.test(n) && !n.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const files = walk('src');

describe('audio on the iPad', () => {
  it('never builds its own AudioContext', () => {
    expect(files.filter((f) => /new\s+(webkit)?AudioContext\b|webkitAudioContext/.test(readFileSync(f, 'utf-8')))).toEqual([]);
  });
  it('never plays through an HTML media element', () => {
    expect(files.filter((f) => /html5\s*:\s*true|new\s+Audio\(/.test(readFileSync(f, 'utf-8')))).toEqual([]);
  });
  it('leaves reduced motion to the eyes', () => {
    expect(walk('src/lib/audio').filter((f) => /reducedMotion|prefers-reduced-motion/.test(readFileSync(f, 'utf-8')))).toEqual([]);
  });
});
