import { describe, expect, it } from 'vitest';
import { GESTURE_EVENTS, onEveryGesture, onNextGesture } from './gestures';

// Final review I3: WebKit starts or resumes audio only on an event that ends a gesture.
describe('the gestures that may unlock or resume audio', () => {
  it('are pointerup, touchend, click and keydown, never a pointerdown', () => {
    expect([...GESTURE_EVENTS].sort()).toEqual(['click', 'keydown', 'pointerup', 'touchend']);
    const page = new EventTarget();
    let n = 0;
    const stop = onEveryGesture(page, () => n++);
    page.dispatchEvent(new Event('pointerdown'));
    page.dispatchEvent(new Event('touchstart'));
    expect(n).toBe(0);
    for (const type of GESTURE_EVENTS) page.dispatchEvent(new Event(type));
    expect(n).toBe(4);
    stop();
    page.dispatchEvent(new Event('click'));
    expect(n).toBe(4);
  });

  it('hears the next one once', () => {
    const page = new EventTarget();
    let n = 0;
    onNextGesture(page, () => n++);
    page.dispatchEvent(new Event('pointerdown'));
    expect(n).toBe(0);
    page.dispatchEvent(new Event('touchend'));
    page.dispatchEvent(new Event('click'));
    expect(n).toBe(1);
  });
});
