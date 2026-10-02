<script lang="ts">
  // A character speaking inside an overlay (immersion wave Ruling W2). The scene's DialogueBox sits
  // on the inert, dimmed stage under the backdrop, so the owl or the Pythia speaks from this plate
  // at the top of the panel instead. Static, no typewriter, not a control.
  import type { Snippet } from 'svelte';
  import type { DialogueLine } from '../../lib/scene/types';
  import { tintedDragon } from '../../lib/living/stillTint';

  // `testId`: a plate spoken inside a panel's own content (the owl on an empty codex page) keeps
  // `overlay-voice` for the one at the top of the overlay. `children`: a line built from live data
  // with its own marked parts (the quest wall's reward and treasure, re-review N13) replaces
  // `line.text`.
  let {
    line,
    testId = 'overlay-voice',
    children,
  }: { line: DialogueLine; testId?: string; children?: Snippet } = $props();
</script>

<figure class="overlay-voice" data-testid={testId} data-speaker={line.speaker} data-key={line.key}>
  <img class="voice-portrait" use:tintedDragon={{ src: line.portrait, tint: line.portraitTint ?? null }} alt="" />
  <figcaption class="voice-body">
    <span class="voice-name">{line.name}</span>
    <span class="voice-text">{#if children}{@render children()}{:else}{line.text}{/if}</span>
  </figcaption>
</figure>

<style>
  /* UI5 playability #18: the same box as the places' dialogue (parchment, upright words), with a
     bronze rim so it stands out of the panel's own parchment. It was night glass with italics, so
     one character spoke from two different boxes. */
  .overlay-voice {
    flex: none;
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0 0 14px;
    padding: 8px 16px 8px 8px;
    border: 2px solid var(--bronze);
    border-radius: 12px;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.4), transparent 60%),
      linear-gradient(180deg, #f8f0dc, #efe0bf);
    color: var(--ink);
    box-shadow:
      inset 0 0 0 1px rgba(255, 240, 200, 0.7),
      inset 0 0 22px rgba(140, 100, 40, 0.16),
      0 3px 8px rgba(0, 0, 0, 0.25);
  }
  /* DialogueBox's portrait treatment (a round, gold-lit frame), at the plate's smaller size. */
  .voice-portrait {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(241, 220, 154, 0.55), rgba(241, 220, 154, 0) 70%);
  }
  .voice-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .voice-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .voice-text {
    font-family: var(--font-body);
    font-size: 18px;
    line-height: 1.35;
  }
</style>
