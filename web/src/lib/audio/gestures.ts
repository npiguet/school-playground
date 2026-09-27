// The events that end a user gesture, the only ones WebKit lets start or resume audio (final review
// I3). HTML's activation-triggering events are a key press, a mouse's pointerdown, a finger's
// pointerup, touchend and click; a finger's pointerdown is not one, and an AudioContext resumed from
// it can stay suspended on an iPad (Howler's own unlock listens on touchend and click for the same
// reason). Every listener that unlocks or resumes the mixer listens on these, in the capture phase,
// so no handler that stops the event's propagation can hide a tap from it.
export const GESTURE_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

const OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

/** Calls `fn` on every completed gesture on `target`; returns the teardown. A tap fires several of
 *  these events (pointerup, touchend, click): `fn` must be idempotent. */
export function onEveryGesture(target: EventTarget, fn: () => void): () => void {
  for (const type of GESTURE_EVENTS) target.addEventListener(type, fn, OPTIONS);
  return () => {
    for (const type of GESTURE_EVENTS) target.removeEventListener(type, fn, OPTIONS);
  };
}

/** Calls `fn` once, on the next completed gesture on `target`. */
export function onNextGesture(target: EventTarget, fn: () => void): void {
  const stop = onEveryGesture(target, () => {
    stop();
    fn();
  });
}
