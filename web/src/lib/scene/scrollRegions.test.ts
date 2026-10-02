import { describe, expect, it } from 'vitest';
import { REGION_LABEL, regionHeading } from './scrollRegions';

// A stand-in for the DOM (vitest runs in node): only what regionHeading asks of an element.
interface Fake {
  classes: string[];
  tag: string;
  children: Fake[];
}
const el = (tag: string, classes: string[] = [], children: Fake[] = []): Fake => ({ tag, classes, children });

function all(e: Fake): Fake[] {
  return e.children.flatMap((c) => [c, ...all(c)]);
}
function matches(e: Fake, selector: string): boolean {
  return selector.split(',').some((s) => {
    const sel = s.trim();
    return sel.startsWith('.') ? e.classes.includes(sel.slice(1)) : e.tag === sel;
  });
}
function asElement(e: Fake): Element {
  return {
    matches: (s: string) => matches(e, s),
    querySelector: (s: string) => {
      const hit = all(e).find((c) => matches(c, s));
      return hit ? asElement(hit) : null;
    },
    tag: e.tag,
    classes: e.classes,
  } as unknown as Element;
}
const tagOf = (h: Element | null) => (h as unknown as { tag: string } | null)?.tag ?? null;
const classesOf = (h: Element | null) => (h as unknown as { classes: string[] } | null)?.classes ?? [];

describe('regionHeading (SP5 residual: a scrolling region is a named region)', () => {
  it("names the overlay's body by the overlay's title, not by a heading of its content", () => {
    const body = el('div', ['overlay-body'], [el('h3', ['kit-section'])]);
    const panel = el('div', ['overlay-panel'], [el('header', [], [el('h2', ['overlay-title'])]), body]);
    const h = regionHeading(asElement(panel.children[1]), asElement(panel));
    expect(tagOf(h)).toBe('h2');
    expect(classesOf(h)).toContain('overlay-title');
  });

  it("names a book's page by its own first heading", () => {
    const page = el('section', ['codex-page'], [el('div', [], [el('h3', ['first'])]), el('h3', ['second'])]);
    const panel = el('div', ['overlay-panel'], [el('h2', ['overlay-title']), el('div', ['overlay-body'], [page])]);
    const h = regionHeading(asElement(page), asElement(panel));
    expect(classesOf(h)).toContain('first');
  });

  it('finds none for a page without a heading (the region then says what it is in words)', () => {
    const page = el('section', ['codex-page'], [el('p')]);
    const panel = el('div', ['overlay-panel'], [el('div', ['overlay-body'], [page])]);
    expect(regionHeading(asElement(page), asElement(panel))).toBeNull();
    expect(REGION_LABEL).toBe('Texte à faire défiler');
  });
});
