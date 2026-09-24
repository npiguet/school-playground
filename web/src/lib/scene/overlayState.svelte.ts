// How many in-world overlays are open (final review I5, M4). Overlay.svelte registers itself while
// mounted; SceneStage makes the scene behind `inert` and FxCanvas pauses while this is > 0. Lives
// outside the stage's context because overlays are rendered next to the stage, not inside it.
export const overlayState = $state({ open: 0 });

/** Registers an open overlay; returns its unregister function. */
export function registerOverlay(): () => void {
  overlayState.open += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    overlayState.open = Math.max(0, overlayState.open - 1);
  };
}
