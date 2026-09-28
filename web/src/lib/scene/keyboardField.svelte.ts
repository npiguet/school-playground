// keyboardField.svelte.ts — the focused text box under `root`, kept whole above the iPad's on-screen
// keyboard (iPad report 2026-09-28), with the visual viewport watched the battle stage's way
// (lib/battle/viewport.svelte.ts, Ruling C4). Call it while a component initialises: every overlay
// does (Overlay.svelte, which also follows the visual viewport with its panel), and so does a text
// box outside one that has no keeping of its own (the dragon's name on the victory sheet). The
// dictation and the proofreading keep their own lines in view (DictationPhase, ProofPhase).
import { keyboardOpen, viewport, watchViewport } from '../battle/viewport.svelte';
import { fitField, isTextField, keepCaretInView, releaseField, scrollerOf } from './fieldInView';

type Field = HTMLTextAreaElement | HTMLInputElement;

export function keepFocusedFieldAboveKeyboard(root: () => HTMLElement | undefined | null): { readonly keyboard: boolean } {
  let field = $state<Field | null>(null);
  const keyboard = $derived(keyboardOpen(viewport));

  $effect(() => watchViewport());

  // The field that has focus under `root` (one focused before the listeners came counts too).
  $effect(() => {
    const r = root();
    if (!r) return;
    const onIn = (e: FocusEvent) => {
      if (isTextField(e.target)) field = e.target;
    };
    const onOut = (e: FocusEvent) => {
      if (!field || e.target !== field) return;
      releaseField(field);
      field = null;
    };
    r.addEventListener('focusin', onIn);
    r.addEventListener('focusout', onOut);
    const active = document.activeElement;
    if (r.contains(active) && isTextField(active)) field = active;
    return () => {
      r.removeEventListener('focusin', onIn);
      r.removeEventListener('focusout', onOut);
    };
  });

  // Once the layout has taken the visual viewport's size (the keyboard's resize, a pan, a new
  // field), the field fits the view of the box that scrolls it; the keyboard gone, its height back.
  $effect(() => {
    const f = field;
    const r = root();
    if (!f || !r) return;
    if (!keyboard) {
      releaseField(f);
      return;
    }
    void viewport.height;
    void viewport.top;
    const id = requestAnimationFrame(() => fitField(f, scrollerOf(f, r)));
    return () => cancelAnimationFrame(id);
  });

  // The caret moves (a tap on another line, the arrows, typing): its line stays in the box's view.
  $effect(() => {
    const f = field;
    if (!keyboard || !(f instanceof HTMLTextAreaElement)) return;
    let id = 0;
    const follow = () => {
      cancelAnimationFrame(id);
      id = requestAnimationFrame(() => {
        if (document.activeElement === f) keepCaretInView(f);
      });
    };
    document.addEventListener('selectionchange', follow);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('selectionchange', follow);
    };
  });

  return {
    get keyboard() {
      return keyboard;
    },
  };
}
