<script lang="ts">
  import { PACE_LABELS, type Pace } from '../lib/dictation/script';

  let { pace = $bindable() }: { pace: Pace } = $props();

  const PACES: Pace[] = [1, 2, 3, 4];
</script>

<div class="pace-select" role="radiogroup" aria-label="Rythme de la dictée">
  {#each PACES as p (p)}
    <label class="card pace-card" class:selected={pace === p}>
      <input
        type="radio"
        name="pace"
        value={p}
        checked={pace === p}
        onchange={() => (pace = p)}
      />
      <span class="pace-title">{PACE_LABELS[p].title}</span>
      <span class="pace-desc muted">{PACE_LABELS[p].description}</span>
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
