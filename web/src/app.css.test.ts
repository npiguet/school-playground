// I6: under `prefers-reduced-motion: reduce`, staggered reveals (Reveal.svelte's
// `animation-delay: {delay}ms`, the Pythia's monster reveal, ...) must show everything
// instantly, not just skip the animation *duration* while staying invisible for the whole
// `animation-delay` (Decision 18). Guards the global CSS rule directly since jsdom does not
// evaluate `@media (prefers-reduced-motion)` blocks, so this can't be asserted via computed
// styles in a component test.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./app.css', import.meta.url)), 'utf-8');

function reducedMotionBlock(): string {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf('\n}', start);
  return css.slice(start, end);
}

// UI4 Ruling C14: the legacy kit retired once nothing used it (placesKit.test.ts guards the markup).
describe('the legacy kit', () => {
  it('defines none of the retired legacy classes', () => {
    for (const c of ['screen', 'btn', 'btn-primary', 'btn-ghost', 'card', 'chip', 'chip-active', 'parchment', 'scene', 'eris-panel']) {
      expect(css, `.${c}`).not.toMatch(new RegExp(`^\\.${c}\\b`, 'm'));
    }
  });
});

describe('reduced motion', () => {
  it('zeroes animation-delay and transition-delay, not just the durations', () => {
    const block = reducedMotionBlock();
    expect(block).toMatch(/animation-delay:\s*0s\s*!important/);
    expect(block).toMatch(/transition-delay:\s*0s\s*!important/);
    expect(block).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
  });
});
