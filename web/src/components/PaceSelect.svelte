<script lang="ts">
  import { PACE_LABELS, type Pace } from '../lib/dictation/script';

  // `minPace` (SP3 Task 7): during a boss fight the pace can't be slowed down below the profile's
  // default (Éris gets no extra warning) - options below it stay visible but disabled, with a
  // reason, rather than disappearing (spec: never take an option away silently).
  let { pace = $bindable(), minPace = 1 }: { pace: Pace; minPace?: Pace } = $props();

  const PACES: Pace[] = [1, 2, 3, 4];
</script>

<div class="pace-select" role="radiogroup" aria-label="Rythme de la dictée">
  {#each PACES as p (p)}
    {@const disabled = p < minPace}
    <label class="card pace-card" class:selected={pace === p} class:disabled data-testid={`pace-option-${p}`}>
      <input
        type="radio"
        name="pace"
        value={p}
        checked={pace === p}
        {disabled}
        onchange={() => (pace = p)}
      />
      <span class="pace-title">{PACE_LABELS[p].title}</span>
      <span class="pace-desc muted">{disabled ? 'Pas pendant un combat' : PACE_LABELS[p].description}</span>
    </label>
  {/each}
</div>

<style>
  .pace-select {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin: 12px 0;
  }
  .pace-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-width: 2px;
  }
  .pace-card.selected {
    border-color: var(--aegean);
    background: var(--aegean-light);
  }
  .pace-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .pace-card input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .pace-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 17px;
  }
  .pace-desc {
    font-size: 14px;
  }
</style>
