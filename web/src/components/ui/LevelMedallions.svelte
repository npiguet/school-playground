<script lang="ts">
  // A row of bronze level medallions (immersion wave Ruling W5): real radio inputs, so the iPad
  // keyboard, VoiceOver and forms keep working, dressed as the medallions of the naming ritual.
  // Replaces LevelSelect's native <select> (playability #3, #4) and the level pills (#2, #7).
  // Re-review N3/N8: `size="sm"` (48 px, 4 px apart) for a row that is secondary (the ritual, where
  // the emblem leads) or squeezed (the desk's side column: seven fit in one row). N14: a word
  // (« Tous ») is set smaller than a code (« 10H »), so it stays inside its disc.
  import { LEVELS } from '../../lib/levels';

  let {
    legend,
    name,
    value = $bindable(),
    options = LEVELS as readonly string[],
    onchange,
    testId,
    size = 'md',
  }: {
    legend: string;
    name: string;
    value: string;
    options?: readonly string[];
    onchange?: (value: string) => void;
    testId?: string;
    size?: 'md' | 'sm';
  } = $props();
</script>

<fieldset class="level-medallions" class:is-sm={size === 'sm'} data-testid={testId}>
  <legend>{legend}</legend>
  <div class="row">
    {#each options as o (o)}
      <label class="kit-medallion" class:is-word={o.length > 3}>
        <input type="radio" {name} value={o} bind:group={value} onchange={() => onchange?.(o)} />
        {o}
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .level-medallions {
    margin: 0 0 1px;
    padding: 0;
    border: 0;
  }
  .level-medallions legend {
    margin-bottom: 1px;
    padding: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .is-sm .row {
    gap: 4px;
  }
  .is-sm .kit-medallion {
    width: 48px;
    height: 48px;
    font-size: 15px;
  }
  .kit-medallion.is-word {
    font-size: 13px;
    letter-spacing: 0;
  }
</style>
