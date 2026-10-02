// A scrolling region with nothing focusable inside cannot be scrolled from the keyboard in WebKit
// (the iPad's engine, and the e2e browser): arrow keys and PageDown scroll the focused element's
// scroller, and focus never gets in. So while a region of the overlay overflows and holds no control,
// it takes a Tab stop of its own (SP5 fix wave: the guide's codex pages are all text). A region that
// fits, or that holds a control (focus already gets in), is left alone: a stop with nothing to scroll
// would only lengthen the Tab walk. A stop is a named region, so a screen reader says what it lands on:
// labelled by the page's heading where there is one, else in plain words.
const CONTROL = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]):not([data-scroll-focus])';

const HEADING = 'h2, h3, h4';
/** The name of a region with no heading of its own. */
export const REGION_LABEL = 'Texte à faire défiler';

/** The heading that names a scrolling region: the overlay's title for the overlay's body (its content's
 *  first heading is only a part of it), else the region's own first heading; null when it has none. */
export function regionHeading(region: Element, root: Element): HTMLElement | null {
  const heading = region.matches('.overlay-body') ? root.querySelector('.overlay-title') : region.querySelector(HEADING);
  return heading as HTMLElement | null;
}

let headingIds = 0;

function name(region: HTMLElement, root: HTMLElement) {
  const heading = regionHeading(region, root);
  if (heading) {
    if (!heading.id) heading.id = `scroll-heading-${++headingIds}`;
    region.setAttribute('aria-labelledby', heading.id);
    region.removeAttribute('aria-label');
  } else {
    region.setAttribute('aria-label', REGION_LABEL);
    region.removeAttribute('aria-labelledby');
  }
}

function scrolls(el: HTMLElement): boolean {
  return /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1;
}

/** Svelte action: keeps each `selector` match inside `node` focusable exactly while it scrolls and
 *  holds no control, as its content and the viewport change. */
export function scrollRegions(node: HTMLElement, selector: string) {
  let frame = 0;
  const resize = new ResizeObserver(() => schedule());
  const mutations = new MutationObserver(() => schedule());

  function update() {
    frame = 0;
    resize.disconnect();
    for (const el of node.querySelectorAll<HTMLElement>(selector)) {
      resize.observe(el);
      for (const child of el.children) resize.observe(child);
      const owned = el.hasAttribute('data-scroll-focus');
      const wanted = scrolls(el) && !el.querySelector(CONTROL);
      if (wanted) {
        if (!owned) {
          el.setAttribute('tabindex', '0');
          el.setAttribute('data-scroll-focus', '');
          el.setAttribute('role', 'region');
        }
        // Again on every change: the page's heading may have come (or gone) since.
        name(el, node);
      } else if (owned) {
        for (const a of ['tabindex', 'data-scroll-focus', 'role', 'aria-labelledby', 'aria-label']) el.removeAttribute(a);
      }
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  mutations.observe(node, { childList: true, subtree: true });
  update();
  return {
    destroy() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    },
  };
}
