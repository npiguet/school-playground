// fieldInView.ts — a text box in an overlay, kept whole above the iPad's on-screen keyboard (iPad
// report 2026-09-28: the lens's text box lay under the keyboard, and its last lines could only be
// reached by closing it). While the keyboard is up the overlay follows the visual viewport (its
// panel, like the battle stage, from lib/battle/viewport.svelte.ts); this module then fits the
// focused field into the overlay's scrolling body: a textarea no taller than the body's view,
// scrolling inside itself, the body scrolled so the field lies whole in view, and the caret's line
// in the textarea's view wherever the caret goes. `release` gives the field its own height back.

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number']);

/** A field the on-screen keyboard opens for: a textarea or a text-like input. */
export function isTextField(el: EventTarget | null): el is HTMLTextAreaElement | HTMLInputElement {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUTS.has(el.type) && !el.readOnly && !el.disabled;
  return false;
}

const FITTED = 'fittedAboveKeyboard';

/** The caret's line in a textarea, in its scroll coordinates (0 = the top of its padding box). A
 *  hidden copy with the same box, font and wrapping lays the text out up to the caret. */
export function caretLine(ta: HTMLTextAreaElement): { top: number; height: number } {
  const cs = getComputedStyle(ta);
  const px = (v: string) => parseFloat(v) || 0;
  const copy = document.createElement('div');
  const s = copy.style;
  for (const p of [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'fontVariant',
    'fontFeatureSettings',
    'letterSpacing',
    'wordSpacing',
    'lineHeight',
    'textTransform',
    'textIndent',
    'tabSize',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
  ] as const) {
    s[p] = cs[p];
  }
  s.position = 'absolute';
  s.visibility = 'hidden';
  s.top = '0';
  s.left = '-10000px';
  s.boxSizing = 'content-box';
  s.border = '0';
  // The textarea's text width: its client width (no scrollbar) less its padding.
  s.width = `${ta.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight)}px`;
  s.whiteSpace = 'pre-wrap';
  s.overflowWrap = 'break-word';
  copy.textContent = ta.value.slice(0, ta.selectionEnd ?? 0);
  const mark = document.createElement('span');
  mark.textContent = '​';
  copy.appendChild(mark);
  document.body.appendChild(copy);
  const top = mark.offsetTop;
  const height = px(cs.lineHeight) || mark.offsetHeight;
  copy.remove();
  return { top, height };
}

/** Scrolls a textarea just enough that the caret's line is in its view. */
export function keepCaretInView(ta: HTMLTextAreaElement): void {
  if (ta.scrollHeight <= ta.clientHeight) return;
  const { top, height } = caretLine(ta);
  const cs = getComputedStyle(ta);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  if (top < ta.scrollTop + padTop) ta.scrollTop = Math.max(0, top - padTop);
  else if (top + height > ta.scrollTop + ta.clientHeight - padBottom) ta.scrollTop = top + height - ta.clientHeight + padBottom;
}

/** The box that scrolls `field` (an overlay's body, an open book's page, the victory sheet): its
 *  nearest ancestor that scrolls vertically, else `fallback`. */
export function scrollerOf(field: HTMLElement, fallback: HTMLElement): HTMLElement {
  for (let el = field.parentElement; el && el !== document.body; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.clientHeight > 0) return el;
  }
  return fallback;
}

/** Fits the focused `field` into the view of `scroller`, clear of its edges by its scroll-padding
 *  (the overlay body's 14 px, where its soft fade lies). */
export function fitField(field: HTMLTextAreaElement | HTMLInputElement, scroller: HTMLElement): void {
  const pad = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
  const room = Math.max(48, scroller.clientHeight - 2 * pad);
  if (field instanceof HTMLTextAreaElement) {
    const cs = getComputedStyle(field);
    // max-height counts the box the way the field sizes itself.
    const extra =
      cs.boxSizing === 'border-box'
        ? 0
        : (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    field.style.maxHeight = `${room - extra}px`;
    field.dataset[FITTED] = '1';
  }
  const s = scroller.getBoundingClientRect();
  const viewTop = s.top + scroller.clientTop + pad;
  const viewBottom = s.top + scroller.clientTop + scroller.clientHeight - pad;
  const r = field.getBoundingClientRect();
  if (r.top < viewTop || r.height > viewBottom - viewTop) scroller.scrollTop += r.top - viewTop;
  else if (r.bottom > viewBottom) scroller.scrollTop += r.bottom - viewBottom;
  if (field instanceof HTMLTextAreaElement) keepCaretInView(field);
}

/** The keyboard went down or the field lost focus: its own height back. */
export function releaseField(field: HTMLElement): void {
  if (field.dataset[FITTED] === undefined) return;
  field.style.maxHeight = '';
  delete field.dataset[FITTED];
}
