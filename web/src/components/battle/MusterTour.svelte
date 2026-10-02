<script lang="ts">
  // The muster's first-visit tour (spec 2026-09-29 explanations §2, plan R11): the dragon explains the
  // pace, the aids, leaving them at the camp and the total, one step at a time, on the plate where
  // Éris's taunt usually stands. Not a modal: the muster stays usable under it (« Commencer la
  // dictée » ends it too); each step lights its part of the parchment (MusterPhase).
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import type { DialogueLine } from '../../lib/scene/types';

  let {
    lines,
    targets,
    onStep,
    onDone,
  }: { lines: DialogueLine[]; targets: (string | null)[]; onStep: (target: string | null) => void; onDone: () => void } = $props();

  let index = $state(0);
  const line = $derived(lines[Math.min(index, lines.length - 1)]);
  const last = $derived(index >= lines.length - 1);
  $effect(() => onStep(targets[index] ?? null));

  function next() {
    if (last) onDone();
    else index += 1;
  }

  // Final review M7: a live region inserted with its words already in is usually not read, so this
  // one comes into the page empty and each step's words are written into it a moment later.
  let announced = $state('');
  $effect(() => {
    const words = line ? `${line.name}\u202f: ${line.text}` : '';
    const timer = setTimeout(() => (announced = words), 100);
    return () => clearTimeout(timer);
  });
</script>

{#if line}
  <div
    class="muster-tour"
    role="group"
    aria-label={'Visite\u202f: la préparation de la bataille'}
    data-testid="muster-tour"
    data-step={index}
    data-target={targets[index] ?? ''}
  >
    <div class="tour-voice">
      <OverlayVoice {line} testId="muster-tour-voice" />
    </div>
    <!-- Only the dragon's words are announced at each step, not the buttons beside them. -->
    <p class="sr-only" aria-live="polite" data-testid="muster-tour-live">{announced}</p>
    <div class="tour-actions">
      {#if !last}
        <button type="button" class="kit-link" data-testid="muster-tour-skip" onclick={onDone}>Passer la visite</button>
      {/if}
      <button type="button" class="kit-bronze is-quiet" data-testid="muster-tour-next" onclick={next}>{last ? "C'est parti\u202f!" : 'Suite'}</button>
    </div>
  </div>
{/if}

<style>
  /* Beside the plate, not under it: the muster's no-scroll budget (scenes-muster-tour.spec.ts) has
     room for a plate as tall as Éris's taunt, not for a row of buttons more. The battle is played in
     landscape only (a phone or a portrait iPad gets « Tourne ton iPad »), so they wrap under the plate
     only in a narrow landscape window. */
  .muster-tour {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
  }
  .tour-voice {
    flex: 1 1 22rem;
    min-width: 0;
  }
  .muster-tour :global(.overlay-voice) {
    margin-bottom: 0;
  }
  /* The dragon's portrait says who speaks; its name stays for a screen reader only, so two lines of
     the tour take no more height than Éris's one-line taunt with its name (the fullest muster of her
     fight fits at 1280×800, 1180×820 and 1024×768). */
  .muster-tour :global(.voice-name) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .tour-actions {
    flex: none;
    margin-left: auto;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 14px;
  }
  .tour-actions button {
    min-height: 48px;
  }
</style>
