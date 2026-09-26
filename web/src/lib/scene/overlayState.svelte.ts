// How many in-world modals are open (final review I5, M4): Overlay and Onboarding register through
// the `modal` action below. SceneStage makes the scene behind `inert` and FxCanvas pauses while this
// is > 0. Lives outside the stage's context because modals are rendered next to the stage.
import { tick, untrack } from 'svelte';

// UI5: `tour` - a first-visit tour is open (TourLayer): the stage is inert as under any modal, but
// keeps its labels, which the tour points at.
export const overlayState = $state({ open: 0, tour: false });

/** Registers an open modal; returns its unregister function. Untracked: a caller's effect must
 *  never depend on the count it changes (that re-ran Overlay's effect in a loop, fix wave 2). */
export function registerOverlay(): () => void {
  untrack(() => (overlayState.open += 1));
  let done = false;
  return () => {
    if (done) return;
    done = true;
    untrack(() => (overlayState.open = Math.max(0, overlayState.open - 1)));
  };
}

// Open modals, oldest first. Only the topmost one traps Tab (fix wave 3: two modals open at once
// used to both trap, and whichever registered last won by accident).
const stack: HTMLElement[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Svelte action for an aria-modal element (the node needs `tabindex="-1"`): registers it (so the
 * stage turns inert), moves focus into it, keeps Tab inside it, and on destroy gives focus back
 * to `returnFocus` (a CSS selector) or to whatever had it before.
 * Tab is moved by hand on every press, not only at the ends: WebKit skips links on Tab by
 * default, which would otherwise walk focus straight out of a panel made of links.
 */
export function modal(node: HTMLElement, opts: { returnFocus?: string } = {}) {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let returnFocus = opts.returnFocus;
  const unregister = registerOverlay();
  node.focus();

  stack.push(node);

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab' || stack[stack.length - 1] !== node) return;
    e.preventDefault();
    const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      node.focus();
      return;
    }
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = items.length;
    items[i === -1 ? (e.shiftKey ? n - 1 : 0) : (i + (e.shiftKey ? n - 1 : 1)) % n].focus();
  }
  document.addEventListener('keydown', onKey, true);

  return {
    update(next: { returnFocus?: string } = {}) {
      returnFocus = next.returnFocus;
    },
    destroy() {
      document.removeEventListener('keydown', onKey, true);
      const at = stack.indexOf(node);
      if (at !== -1) stack.splice(at, 1);
      unregister();
      // After the stage has dropped `inert` (next flush), or focus() on it would be ignored.
      void tick().then(() => {
        const target = (returnFocus ? document.querySelector<HTMLElement>(returnFocus) : null) ?? opener;
        if (target && target.isConnected && target !== document.body) target.focus();
      });
    },
  };
}
