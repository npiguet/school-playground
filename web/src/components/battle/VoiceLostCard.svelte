<script lang="ts">
  // Éris's card when the voice cannot be heard (spec 2026-09-27 §5.3): she gloats in-fiction, the card
  // sends the player to a parent, and a small line names the cause for that parent. « Réessayer » asks
  // for the same line again; the way back to the camp (the dictation only) leaves as « Quitter » does,
  // the draft kept. The lyre's trial uses the short form: no way back (the lyre is an overlay).
  import { untrack } from 'svelte';
  import { sayKey } from '../../lib/dialogue/select';
  import { VOICE_LOST } from '../../lib/battle/lines';
  import { focusOnMount } from '../../lib/battle/focus';
  import type { VoiceFailure } from '../../lib/dictation/voice';

  let { failure, onRetry, onLeave }: { failure: VoiceFailure; onRetry: () => void; onLeave?: () => void } = $props();

  // Picked once, when the card opens (UI5 Ruling E14: a pick never lives in a $derived).
  const line = untrack(() => sayKey('battle.voice.lost'));
</script>

<div class="kit-note voice-lost" data-tone="eris" role="alert" data-testid="voice-lost" data-failure={failure}>
  <p class="eris" data-testid="voice-lost-eris" data-key={line.key}>
    <img class="portrait" src={line.portrait} alt="" style:filter={line.portraitFilter ?? null} />
    <span><strong>{line.name}</strong> <span data-testid="voice-lost-eris-text">{line.text}</span></span>
  </p>
  <p class="ask">{VOICE_LOST.askParent}</p>
  <p class="cause" data-testid="voice-lost-cause">{VOICE_LOST.cause[failure]}</p>
  <div class="actions">
    <button type="button" class="kit-bronze" data-testid="btn-voice-retry" onclick={onRetry} use:focusOnMount>{VOICE_LOST.retry}</button>
    {#if onLeave}
      <button type="button" class="kit-bronze is-quiet" data-testid="btn-voice-camp" onclick={onLeave}>{VOICE_LOST.toCamp}</button>
    {/if}
  </div>
</div>

<style>
  .voice-lost {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .voice-lost p {
    margin: 0;
  }
  .eris {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .portrait {
    flex: none;
    width: 56px;
    height: 56px;
    object-fit: contain;
  }
  .ask {
    font-weight: 600;
  }
  /* The parent's line: small, but readable (it is what a parent reads out when asking for help). */
  .cause {
    font-size: 14px;
    font-style: italic;
    color: var(--ink-soft);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
</style>
