<script lang="ts">
  // Éris's card when the voice cannot be heard (spec 2026-09-27 §5.3): she gloats in-fiction, the card
  // tells the player to try again and then to call a parent, and a small line names the cause for that
  // parent. « Réessayer » asks for the same line again; the way back to the camp (the dictation only)
  // leaves as « Quitter » does, the draft kept. The lyre's trial uses the short form: no way back (the
  // lyre is an overlay).
  // Fix wave B (playability #5, #7): the card stays up while « Réessayer » asks again (`retrying`: the
  // button waits, the Pythia says she tries), so a failed try keeps the same gloat, never a new one
  // in reply to her tap; Éris speaks from the same plate as everywhere else (name above, portrait left).
  import { untrack } from 'svelte';
  import { sayKey } from '../../lib/dialogue/select';
  import { VOICE_LOST } from '../../lib/battle/lines';
  import { focusOnMount } from '../../lib/battle/focus';
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import type { VoiceFailure } from '../../lib/dictation/voice';

  // `compact`: under the keyboard (Ruling C4) the plate is smaller and the parent's line joins the
  // buttons' row, so a line of her draft stays in sight below the card.
  let {
    failure,
    retrying = false,
    compact = false,
    onRetry,
    onLeave,
  }: { failure: VoiceFailure; retrying?: boolean; compact?: boolean; onRetry: () => void; onLeave?: () => void } = $props();

  // Picked once, when the card opens (UI5 Ruling E14: a pick never lives in a $derived).
  const line = untrack(() => sayKey('battle.voice.lost'));
</script>

{#snippet cause()}
  <p class="cause" data-testid="voice-lost-cause">{VOICE_LOST.cause[failure]}</p>
{/snippet}

<div class="kit-note voice-lost" class:compact data-tone="eris" role="alert" data-testid="voice-lost" data-failure={failure} data-retrying={retrying}>
  <OverlayVoice {line} testId="voice-lost-eris"><span data-testid="voice-lost-eris-text">{line.text}</span></OverlayVoice>
  <p class="ask">{VOICE_LOST.askParent}</p>
  {#if !compact}{@render cause()}{/if}
  <div class="actions">
    <button type="button" class="kit-bronze" data-testid="btn-voice-retry" onclick={onRetry} disabled={retrying} use:focusOnMount>{VOICE_LOST.retry}</button>
    {#if onLeave}
      <button type="button" class="kit-bronze is-quiet" data-testid="btn-voice-camp" onclick={onLeave}>{VOICE_LOST.toCamp}</button>
    {/if}
    {#if retrying}
      <span class="retrying" role="status" data-testid="voice-lost-retrying">{VOICE_LOST.retrying}</span>
    {/if}
    {#if compact}{@render cause()}{/if}
  </div>
</div>

<style>
  /* The plate's portrait already names the speaker: no wax seal beside it (playability #7). */
  .voice-lost {
    --note-pad: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .voice-lost::before {
    display: none;
  }
  .voice-lost :global(.overlay-voice) {
    margin: 0;
  }
  .voice-lost p {
    margin: 0;
  }
  .ask {
    font-weight: 600;
  }
  /* The parent's line: secondary, but legible at arm's length, over her shoulder (playability #13). */
  .cause {
    font-size: 15px;
    color: var(--ink);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .retrying {
    font-style: italic;
    color: var(--ink-soft);
  }
  .compact {
    gap: 6px;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .compact :global(.overlay-voice) {
    padding: 4px 12px 4px 4px;
  }
  .compact :global(.voice-portrait) {
    width: 44px;
    height: 44px;
  }
  .compact :global(.voice-text) {
    font-size: 16px;
  }
  .compact .cause {
    margin-left: auto;
  }
</style>
