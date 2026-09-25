<script lang="ts">
  // A row of bronze level medallions (immersion wave Ruling W5): real radio inputs, so the iPad
  // keyboard, VoiceOver and forms keep working, dressed as the medallions of the naming ritual.
  // Replaces LevelSelect's native <select> (playability #3, #4) and the level pills (#2, #7).
  import { LEVELS } from '../../lib/levels';

  let {
    legend,
    name,
    value = $bindable(),
    options = LEVELS as readonly string[],
    onchange,
    testId,
  }: {
    legend: string;
    name: string;
    value: string;
    options?: readonly string[];
    onchange?: (value: string) => void;
    testId?: string;
  } = $props();
</script>

<fieldset class="level-medallions" data-testid={testId}>
  <legend>{legend}</legend>
  <div class="row">
    {#each options as o (o)}
      <label class="kit-medallion">
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
</style>
