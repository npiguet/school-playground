// Scenes UI spec §2.7: Cinzel / Alegreya / Literata, self-hosted woff2, latin + latin-ext, OFL,
// never fetched from a third party. vitest runs with cwd = web/.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const fontsCss = readFileSync('src/styles/fonts.css', 'utf-8');
const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
const FAMILIES = ['cinzel', 'alegreya', 'literata'];

describe('self-hosted fonts (scenes spec §2.7)', () => {
  it('declares latin and latin-ext faces for Cinzel, Alegreya and Literata', () => {
    for (const pkg of FAMILIES) {
      expect(urls.some((u) => new RegExp(`^/fonts/${pkg}/${pkg}-latin-\\d`).test(u)), `${pkg} latin`).toBe(true);
      expect(urls.some((u) => new RegExp(`^/fonts/${pkg}/${pkg}-latin-ext-\\d`).test(u)), `${pkg} latin-ext`).toBe(true);
    }
    for (const family of ['Cinzel', 'Alegreya', 'Literata']) expect(fontsCss).toContain(`font-family: '${family}'`);
  });

  it('every face is a local woff2 file and the whole set stays under 450 KB', () => {
    let total = 0;
    for (const u of urls) {
      expect(u.startsWith('/fonts/'), u).toBe(true);
      const file = 'public' + u;
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file).subarray(0, 4).toString('latin1'), file).toBe('wOF2');
      total += statSync(file).size;
    }
    expect(urls.length).toBe(14);
    expect(total).toBeLessThan(450 * 1024);
  });

  it('ships the OFL licence with each family', () => {
    for (const pkg of FAMILIES) {
      expect(readFileSync(`public/fonts/${pkg}/OFL.txt`, 'utf-8')).toContain('SIL Open Font License');
    }
  });

  it('never asks a third-party origin for fonts', () => {
    const sources = [
      readFileSync('index.html', 'utf-8'),
      readFileSync('src/app.css', 'utf-8'),
      ...readdirSync('src/styles')
        .filter((f) => f.endsWith('.css'))
        .map((f) => readFileSync(`src/styles/${f}`, 'utf-8')),
    ];
    for (const s of sources) expect(s).not.toMatch(/fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*['"]?https?:/);
  });

  it('maps the tokens: Cinzel titles, Alegreya body, Literata reading text', () => {
    const app = readFileSync('src/app.css', 'utf-8');
    expect(app).toMatch(/--font-display:\s*'Cinzel'/);
    expect(app).toMatch(/--font-body:\s*'Alegreya'/);
    expect(app).toMatch(/--font-reading:\s*'Literata'/);
    for (const c of ['DictationPhase', 'TokenText', 'ProofPhase', 'WordEditor']) {
      // `font-family:` or the `font:` shorthand (UI4 Tasks 4-5 set size and line height with it).
      expect(readFileSync(`src/components/battle/${c}.svelte`, 'utf-8'), c).toMatch(/\bfont(?:-family)?:[^;]*var\(--font-reading\)/);
    }
  });
});
