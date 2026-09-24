<script lang="ts">
  // Narrator box (scenes UI spec §4, §2.5): portrait + typewriter, tap to finish / advance,
  // « Tout passer » to close. UI1 takes static lines from props; UI5 feeds it dialogue content files.
  // Sits in the art box's dialogue dock, which hotspots never overlap (plan Ruling 3).
  import { reducedMotion } from '../../lib/juice/motion';
  import { DIALOGUE_DOCK } from '../../lib/scene/geometry';
  import { advance, typedLength } from '../../lib/scene/typewriter';
  import type { DialogueLine } from '../../lib/scene/types';

  let { lines, onDone }: { lines: DialogueLine[]; onDone: () => void } = $props();

  let index = $state(0);
  let shown = $state(0);
  // `lines` may be empty (UI5 feeds this from dialogue content files; a missing/empty event key is
  // valid data, not a bug): `advance()` never walks `index` past the last real line (on the final
  // line it returns `done: true` while leaving `index` right where it was), so once `lines` has at
  // least one entry `line` stays defined for the component's whole lifetime. It's only ever
  // `undefined` when `lines` was empty to begin with - handled below by closing immediately instead
  // of ever trying to render or read `.text` off a line that doesn't exist.
  const line = $derived<DialogueLine | undefined>(lines[index]);
  const complete = $derived(line !== undefined && shown >= line.text.length);

  $effect(() => {
    if (lines.length === 0) onDone();
  });

  $effect(() => {
    if (!line) return;
    const text = line.text;
    if (reducedMotion()) {
      shown = text.length;
      return;
    }
    shown = 0;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      shown = Math.max(shown, typedLength(text, now - start));
      if (shown < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // Final review M6: the live region is inserted empty and only then filled, so VoiceOver announces
  // the first line too (a region that arrives with its text already in it is not announced).
  let announced = $state('');
  $effect(() => {
    const text = line?.text ?? '';
    const t = setTimeout(() => (announced = text), 120);
    return () => clearTimeout(t);
  });

  function next() {
    // Only reachable via the .advance button below, which only renders `{#if line}` - `line` is
    // always defined here.
    const r = advance({ index, shown }, lines);
    if (r.done) {
      onDone();
      return;
    }
    index = r.index;
    shown = r.shown;
  }
</script>

{#if line}
  <div
    class="dialogue kit-parchment"
    role="group"
    aria-label="Dialogue"
    data-testid="dialogue-box"
    style="left:{DIALOGUE_DOCK.x}%;width:{DIALOGUE_DOCK.w}%;max-height:{DIALOGUE_DOCK.h - 2}%"
  >
    <img class="portrait" src={line.portrait} alt="" style="filter:{line.portraitFilter ?? 'none'}" />
    <button
      type="button"
      class="advance"
      data-testid="dialogue-advance"
      aria-label={complete ? 'Suite' : 'Tout afficher'}
      onclick={next}
    >
      <span class="speaker">{line.name}</span>
      <span class="text" data-testid="dialogue-text" aria-hidden="true">{line.text.slice(0, shown)}</span>
      <span class="sr-only" aria-live="polite" data-testid="dialogue-live">{announced}</span>
      {#if complete}<span class="more" class:still={reducedMotion()} aria-hidden="true">▸</span>{/if}
    </button>
    <button type="button" class="kit-bronze skip" data-testid="dialogue-skip" onclick={onDone}>Tout passer</button>
  </div>
{/if}

<style>
  .dialogue {
    position: absolute;
    bottom: 2%;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    overflow: hidden;
  }
  .portrait {
    width: 84px;
    height: 84px;
    flex-shrink: 0;
    object-fit: contain;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(241, 220, 154, 0.55), rgba(241, 220, 154, 0) 70%);
  }
  .advance {
    flex: 1;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: var(--ink);
  }
  .speaker {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .text {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.35;
    min-height: 1.35em;
  }
  /* Playability #11: a big, gently bobbing « next » caret, clearly different from « Tout passer ». */
  .more {
    align-self: flex-end;
    font-size: 30px;
    line-height: 1;
    color: var(--bronze);
    animation: dialogue-more 1.2s ease-in-out infinite;
  }
  /* Reduced motion: no movement, a slow fade (beats app.css's blanket reduced-motion rule). */
  .more.still {
    animation: dialogue-more-fade 1.6s ease-in-out infinite !important;
  }
  @keyframes dialogue-more {
    0%,
    100% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(5px);
    }
  }
  @keyframes dialogue-more-fade {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  .skip {
    flex-shrink: 0;
  }
</style>
