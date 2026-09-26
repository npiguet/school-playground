// viewport.svelte.ts — the visual viewport (what the iPad keyboard leaves), watched once, refcounted
// (Ruling C4). `window.visualViewport` is read at every event, never cached, so the e2e keyboard
// (helpers.ts installKeyboardSim) stands in for it. The battle stage turns it into its own --vvh and
// --vv-top (M13: on the stage, not on :root, so a pan restyles the stage alone, and only in compact).
// A value that did not change is not written, so an event that moves nothing notifies nobody.
export const viewport = $state({ height: 0, top: 0, inner: 0, scale: 1 });

let users = 0;
let stop: (() => void) | null = null;

function set<K extends keyof typeof viewport>(key: K, value: number): void {
  if (viewport[key] !== value) viewport[key] = value;
}

function start(): () => void {
  const update = () => {
    const vv = window.visualViewport;
    set('height', vv?.height ?? window.innerHeight);
    set('top', vv?.offsetTop ?? 0);
    set('inner', window.innerHeight);
    set('scale', vv?.scale ?? 1);
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
