<script lang="ts">
  // A character speaking inside an overlay (immersion wave Ruling W2). The scene's DialogueBox sits
  // on the inert, dimmed stage under the backdrop, so the owl or the Pythia speaks from this plate
  // at the top of the panel instead. Static, no typewriter, not a control.
  import type { DialogueLine } from '../../lib/scene/types';

  let { line }: { line: DialogueLine } = $props();
</script>

<figure class="overlay-voice" data-testid="overlay-voice" data-speaker={line.speaker}>
  <img class="voice-portrait" src={line.portrait} alt="" style:filter={line.portraitFilter} />
  <figcaption class="voice-body">
    <span class="voice-name">{line.name}</span>
    <span class="voice-text">{line.text}</span>
  </figcaption>
</figure>

<style>
  .overlay-voice {
    flex: none;
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0 0 14px;
    padding: 8px 16px 8px 8px;
    border: 1px solid var(--bronze-light);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(21, 18, 26, 0.84), rgba(21, 18, 26, 0.72));
    color: var(--bronze-ink);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }
  /* DialogueBox's portrait treatment (a round, gold-lit frame), at the plate's smaller size. */
  .voice-portrait {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(241, 220, 154, 0.28), transparent 70%);
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
    color: var(--gold-light);
  }
  .voice-text {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 18px;
    line-height: 1.35;
  }
</style>
