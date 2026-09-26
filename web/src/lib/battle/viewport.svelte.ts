// viewport.svelte.ts — the visual viewport (what the iPad keyboard leaves), watched once, refcounted
// (Ruling C4). It owns --vvh and --vv-top; Dictation and Proofreading used to each set and remove
// --vvh. `window.visualViewport` is read at every event, never cached, so the e2e keyboard
// (helpers.ts installKeyboardSim) stands in for it.
export const viewport = $state({ height: 0, top: 0, inner: 0 });

let users = 0;
let stop: (() => void) | null = null;

function start(): () => void {
  const root = document.documentElement;
  const update = () => {
    const vv = window.visualViewport;
    viewport.height = vv?.height ?? window.innerHeight;
    viewport.top = vv?.offsetTop ?? 0;
    viewport.inner = window.innerHeight;
    root.style.setProperty('--vvh', `${viewport.height}px`);
    root.style.setProperty('--vv-top', `${viewport.top}px`);
  };
  update();
  const vv = window.visualViewport;
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  return () => {
    vv?.removeEventListener('resize', update);
    vv?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    root.style.removeProperty('--vvh');
    root.style.removeProperty('--vv-top');
  };
}

/** Starts watching (once, however many callers); returns this caller's release (idempotent). */
export function watchViewport(): () => void {
  users += 1;
  if (users === 1) stop = start();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users === 0) {
      stop?.();
      stop = null;
    }
  };
}
