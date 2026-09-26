// focus.ts — a confirm takes the focus when it opens (final review M9): a keyboard or switch user
// lands on its first answer instead of hunting for it. When it closes with the focus still inside
// (or dropped to the page), the focus goes back to where it was, if that is still on the page.
export function focusOnMount(node: HTMLElement) {
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  node.focus();
  return {
    destroy() {
      const now = document.activeElement;
      const lost = !now || now === document.body || node.contains(now);
      if (lost && before && before !== node && before.isConnected) before.focus();
    },
  };
}
