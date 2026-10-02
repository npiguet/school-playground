// A scrolling region with nothing focusable inside cannot be scrolled from the keyboard in WebKit
// (the iPad's engine, and the e2e browser): arrow keys and PageDown scroll the focused element's
// scroller, and focus never gets in. So while a region of the overlay overflows and holds no control,
// it takes a Tab stop of its own (SP5 fix wave: the guide's codex pages are all text). A region that
// fits, or that holds a control (focus already gets in), is left alone: a stop with nothing to scroll
// would only lengthen the Tab walk.
const CONTROL = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]):not([data-scroll-focus])';

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
      if (wanted && !owned) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('data-scroll-focus', '');
      } else if (!wanted && owned) {
        el.removeAttribute('tabindex');
        el.removeAttribute('data-scroll-focus');
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
